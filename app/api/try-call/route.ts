import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { DEMO_CALLS_PER_IP_PER_DAY } from "@/lib/demo/try-call";
import { TRIAL_CALLS_PER_DAY } from "@/lib/demo/trials";
import { trialByCode } from "@/lib/demo/trials-server";
import {
  areBrowserCallsEnabled,
  claimDemoCall,
  createWebCall,
  isDemoCallEnabled,
  publicCallsLeft,
} from "@/lib/demo/try-call-server";

export const dynamic = "force-dynamic";

/**
 * GET → { enabled } for the landing page's public demo.
 * GET ?code=… → a clinic trial's state for /dene/<code>.
 */
export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get("code");
  if (!code) {
    const enabled = isDemoCallEnabled();
    return NextResponse.json({ enabled, left: enabled ? await publicCallsLeft(clientIp(req)) : null });
  }

  const trial = await trialByCode(code);
  if (!trial) return NextResponse.json({ found: false }, { status: 404 });
  return NextResponse.json({
    found: true,
    enabled: areBrowserCallsEnabled() && Boolean(trial.vapiAssistantId),
    clinicName: trial.clinicName,
    ...trial.status,
    maxCalls: trial.maxCalls,
  });
}

/**
 * POST { code?, voice?, website? } → { call, left } for one browser call
 * (for a trial, `left` is what remains for that voice):
 * the landing page's demo assistant, or — with a code — that clinic
 * trial's. Every call costs real minutes, so in order: the master switch, a
 * honeypot, a per-visitor limit, then the durable caps (public: per visitor
 * and per day; trial: its own days, calls and per-day starts). The call is
 * created here with the private key; the page only joins its room, so it
 * can't change the assistant (duration, prompt). Every start counts.
 */
export async function POST(req: Request) {
  if (!areBrowserCallsEnabled()) return NextResponse.json({ ok: false, error: "disabled" }, { status: 503 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  // Honeypot: a field no person sees. Pretend it's off rather than say why.
  if (typeof body?.website === "string" && body.website.trim()) {
    return NextResponse.json({ ok: false, error: "disabled" }, { status: 503 });
  }

  const code = typeof body?.code === "string" ? body.code.trim() : "";
  let assistantId: string;
  let trialId: string | null = null;
  let trialLeft = 0;
  const voice = body?.voice === "male" ? "male" : "female";

  if (code) {
    const trial = await trialByCode(code);
    if (!trial || !trial.vapiAssistantId) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    if (!trial.status.active) return NextResponse.json({ ok: false, error: trial.status.reason }, { status: 403 });
    // Each voice has its own allowance; the other voice may still have calls.
    if (trial.status.voiceLeft[voice] <= 0) return NextResponse.json({ ok: false, error: "voice_used_up", left: 0 }, { status: 403 });
    assistantId = trial.vapiAssistantId;
    trialId = trial.id;
    trialLeft = trial.status.voiceLeft[voice] - 1;
  } else {
    if (!isDemoCallEnabled()) return NextResponse.json({ ok: false, error: "disabled" }, { status: 503 });
    assistantId = process.env.VAPI_DEMO_ASSISTANT_ID!.trim();
  }

  const ip = clientIp(req);
  const perIp = trialId ? TRIAL_CALLS_PER_DAY : DEMO_CALLS_PER_IP_PER_DAY;
  if (!rateLimit(`try-call:${trialId ?? "public"}:${ip}`, perIp, 24 * 60 * 60 * 1000)) {
    return NextResponse.json({ ok: false, error: trialId ? "trial_daily" : "rate_limited" }, { status: 429 });
  }

  const claim = await claimDemoCall(ip, trialId, voice);
  if (claim.result === "cap") return NextResponse.json({ ok: false, error: "daily_cap" }, { status: 429 });
  if (claim.result === "ip_limit") return NextResponse.json({ ok: false, error: "rate_limited", left: 0 }, { status: 429 });
  if (claim.result === "trial_daily") return NextResponse.json({ ok: false, error: "trial_daily" }, { status: 429 });
  if (claim.result === "error") return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });

  const call = await createWebCall(assistantId, voice);
  if (!call) return NextResponse.json({ ok: false, error: "failed" }, { status: 502 });
  return NextResponse.json({ ok: true, call, left: trialId ? Math.max(0, trialLeft) : (claim.left ?? null) });
}

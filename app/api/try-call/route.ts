import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { DEMO_CALLS_PER_IP_PER_DAY } from "@/lib/demo/try-call";
import { TRIAL_CALLS_PER_DAY } from "@/lib/demo/trials";
import { trialByCode } from "@/lib/demo/trials-server";
import {
  allowedOrigins,
  areBrowserCallsEnabled,
  claimDemoCall,
  isDemoCallEnabled,
  signDemoToken,
} from "@/lib/demo/try-call-server";

export const dynamic = "force-dynamic";

/**
 * GET → { enabled } for the landing page's public demo.
 * GET ?code=… → a clinic trial's state for /dene/<code>.
 */
export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get("code");
  if (!code) return NextResponse.json({ enabled: isDemoCallEnabled() });

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
 * POST { code?, website? } → { token, assistantId } for one browser call:
 * the landing page's demo assistant, or — with a code — that clinic
 * trial's. Every call costs real minutes, so in order: the master switch, a
 * honeypot, a per-visitor limit, then the durable caps (public: per day;
 * trial: its own days, calls and per-day starts). The token works only for
 * that one assistant, from our origin, for five minutes.
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

  if (code) {
    const trial = await trialByCode(code);
    if (!trial || !trial.vapiAssistantId) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    if (!trial.status.active) return NextResponse.json({ ok: false, error: trial.status.reason }, { status: 403 });
    assistantId = trial.vapiAssistantId;
    trialId = trial.id;
  } else {
    if (!isDemoCallEnabled()) return NextResponse.json({ ok: false, error: "disabled" }, { status: 503 });
    assistantId = process.env.VAPI_DEMO_ASSISTANT_ID!.trim();
  }

  const ip = clientIp(req);
  const perIp = trialId ? TRIAL_CALLS_PER_DAY : DEMO_CALLS_PER_IP_PER_DAY;
  if (!rateLimit(`try-call:${trialId ?? "public"}:${ip}`, perIp, 24 * 60 * 60 * 1000)) {
    return NextResponse.json({ ok: false, error: trialId ? "trial_daily" : "rate_limited" }, { status: 429 });
  }

  const claim = await claimDemoCall(ip, trialId);
  if (claim === "cap") return NextResponse.json({ ok: false, error: "daily_cap" }, { status: 429 });
  if (claim === "trial_daily" || claim === "trial_starts") return NextResponse.json({ ok: false, error: claim }, { status: 429 });
  if (claim === "error") return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });

  const token = signDemoToken({
    orgId: process.env.VAPI_ORG_ID!.trim(),
    privateKey: process.env.VAPI_API_KEY!.trim(),
    assistantId,
    origins: allowedOrigins(),
  });
  return NextResponse.json({ ok: true, token, assistantId });
}

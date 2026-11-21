import { NextResponse } from "next/server";
import appConfig from "@/app.config";
import { addDemoRequestReturningId } from "@/lib/demo-requests/queries";
import { parseKnowledgeText, SELF_SERVE_TRIALS_PER_DAY, SELF_SERVE_TRIALS_PER_IP_PER_DAY } from "@/lib/demo/trials";
import { createTrial, deleteTrial, selfServeCounts, trialByEmail } from "@/lib/demo/trials-server";
import { areBrowserCallsEnabled, hashIp } from "@/lib/demo/try-call-server";
import { isEmailConfigured, sendTrialLinkEmail } from "@/lib/notify/email";
import { notifyTrialCreated } from "@/lib/notify/telegram";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
// Creating a trial provisions a Vapi assistant.
export const maxDuration = 60;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[0-9 ()-]{7,20}$/;

/**
 * Self-serve clinic trial — /demo-talep → "Hemen kendiniz deneyin".
 *
 * The /dene/<code> link is never returned here: it is emailed (Resend) to the
 * address typed in, so only someone who reads that inbox can call. Guard
 * rails, all before any Vapi work: master switch, honeypot, one trial per
 * address (asking again re-sends the same link), one new trial per IP per day
 * and SELF_SERVE_TRIALS_PER_DAY in total — the last two counted in Supabase.
 */

function enabled() {
  return areBrowserCallsEnabled() && isEmailConfigured();
}

/** GET → { enabled }: /demo-talep shows the self-serve option only when it can work. */
export async function GET() {
  return NextResponse.json({ enabled: enabled() });
}

/** Where the emailed link points: the fixed public domain in production, never the request's Host header. */
function siteOrigin(req: Request): string {
  return process.env.NODE_ENV === "production" ? `https://www.${appConfig.domain}` : new URL(req.url).origin;
}

export async function POST(req: Request) {
  if (!enabled()) return NextResponse.json({ ok: false, error: "disabled" }, { status: 503 });
  const ip = clientIp(req);
  if (!rateLimit(`trial:${ip}`, 5, 60 * 60 * 1000)) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const text = (key: string, max: number) => (typeof body?.[key] === "string" ? (body[key] as string).trim().slice(0, max) : "");
  // Honeypot: looks like success, does nothing.
  if (text("website", 200)) return NextResponse.json({ ok: true });

  const clinicName = text("clinicName", 80);
  const contactName = text("contactName", 120);
  const phone = text("phone", 30);
  const email = text("email", 200).toLowerCase();
  const invalid = (error: string) => NextResponse.json({ ok: false, error }, { status: 400 });
  if (clinicName.length < 2) return invalid("clinic_name");
  if (contactName.length < 2) return invalid("contact_name");
  if (!PHONE_RE.test(phone) || phone.replace(/\D/g, "").length < 7) return invalid("phone");
  if (!EMAIL_RE.test(email)) return invalid("email");

  const origin = siteOrigin(req);
  const mailFor = (t: { code: string; clinicName: string; expiresAt: string; maxCalls: number }) =>
    sendTrialLinkEmail(email, { clinicName: t.clinicName, contactName, link: `${origin}/dene/${t.code}`, expiresAt: t.expiresAt, maxCalls: t.maxCalls });

  // One trial per address. Asking again re-sends the same link to the same
  // inbox (harmless), at most a few times a day.
  const existing = await trialByEmail(email);
  if (existing) {
    if (!rateLimit(`trial-resend:${email}`, 3, 24 * 60 * 60 * 1000)) {
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }
    const sent = await mailFor(existing);
    return sent ? NextResponse.json({ ok: true, resent: true }) : NextResponse.json({ ok: false, error: "email_failed" }, { status: 502 });
  }

  const ipHash = hashIp(ip);
  const counts = await selfServeCounts(ipHash);
  if (!counts) return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  if (counts.fromIp >= SELF_SERVE_TRIALS_PER_IP_PER_DAY) return NextResponse.json({ ok: false, error: "ip_limit" }, { status: 429 });
  if (counts.today >= SELF_SERVE_TRIALS_PER_DAY) return NextResponse.json({ ok: false, error: "daily_full" }, { status: 429 });

  const knowledge = parseKnowledgeText({
    services: text("services", 4000),
    doctors: text("doctors", 2000),
    address: text("address", 500),
    faq: "",
  });

  // The contact details live where every lead does: /admin → Demo talepleri.
  const demoRequestId = await addDemoRequestReturningId({
    clinicName,
    contactName,
    phone,
    email,
    note: "Web denemesini kendisi açtı (/demo-talep).",
  });
  if (!demoRequestId) return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });

  const created = await createTrial({ clinicName, knowledge, demoRequestId, self: { email, ipHash } });
  if (!created.ok) {
    if (created.error === "email_taken") return NextResponse.json({ ok: true, resent: true });
    console.error("[trial] create failed:", created.error);
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  }

  if (!(await mailFor(created.data))) {
    // Nobody could reach the link: undo, so the address can try again.
    await deleteTrial(created.data.id);
    return NextResponse.json({ ok: false, error: "email_failed" }, { status: 502 });
  }

  await notifyTrialCreated({ source: "demo-talep", message: "Ayrıntılar: /admin → Denemeler ve Demo talepleri" });
  return NextResponse.json({ ok: true });
}

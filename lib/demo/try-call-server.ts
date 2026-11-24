import { createHash, createHmac } from "node:crypto";
import appConfig from "@/app.config";
import { getSupabaseServer } from "@/lib/supabase/server";
import { DEMO_CALLS_PER_IP_PER_DAY, demoDailyCap } from "@/lib/demo/try-call";
import { TRIAL_CALLS_PER_DAY } from "@/lib/demo/trials";
import { voiceFor } from "@/lib/vapi/client";

/**
 * Server half of the landing-page browser call (see lib/demo/try-call.ts).
 * Nothing here is reachable without app/api/try-call's gates in front of it.
 */

/** Days a hashed demo-call row is kept; lib/privacy/retention.ts deletes older ones. */
export const DEMO_CALL_DAYS = 30;

/** The master switch for every browser call — the public demo and the clinic trials alike. */
export function areBrowserCallsEnabled(): boolean {
  return process.env.DEMO_CALL_ENABLED === "true" && Boolean(process.env.VAPI_API_KEY?.trim() && process.env.VAPI_ORG_ID?.trim());
}

/** The landing page's public demo also needs its assistant. */
export function isDemoCallEnabled(): boolean {
  return areBrowserCallsEnabled() && Boolean(process.env.VAPI_DEMO_ASSISTANT_ID?.trim());
}

/** Salted, so the table can't be reversed into addresses by hashing the IPv4 space. */
export function hashIp(ip: string): string {
  const salt = process.env.DEMO_IP_SALT?.trim() || process.env.VAPI_WEBHOOK_SECRET?.trim() || "randevox";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

export type DemoVoice = "female" | "male";

/** The male option: the same ElevenLabs persona a clinic can pick on /agents. */
const MALE_VOICE = "Orion · deep male";

export interface WebCallJoin {
  id: string;
  webCallUrl: string;
  transport?: { callToken?: string };
}

/** The origin the server-side call is made from — and the only one its token allows. */
const CALL_ORIGIN = `https://www.${appConfig.domain}`;

const b64url = (input: Buffer | string) => Buffer.from(input).toString("base64url");

/**
 * A short-lived public Vapi JWT for one assistant and one origin
 * (docs.vapi.ai/customization/jwt-authentication): HS256, signed with the
 * private key. Vapi's /call/web takes only this kind of key, not the private
 * one — and this token never leaves the server.
 */
export function signDemoToken(opts: {
  orgId: string;
  privateKey: string;
  assistantId: string;
  origins: string[];
  ttlSeconds?: number;
  now?: number;
}): string {
  const iat = Math.floor((opts.now ?? Date.now()) / 1000);
  const payload = {
    orgId: opts.orgId,
    iat,
    exp: iat + (opts.ttlSeconds ?? 60),
    token: {
      tag: "public",
      name: "randevox-web-demo",
      restrictions: {
        enabled: true,
        allowedOrigins: opts.origins,
        allowedAssistantIds: [opts.assistantId],
        allowTransientAssistant: false,
      },
    },
  };
  const unsigned = `${b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${b64url(JSON.stringify(payload))}`;
  return `${unsigned}.${createHmac("sha256", opts.privateKey).update(unsigned).digest("base64url")}`;
}

/**
 * Starts the browser call here and hands the page only the room to join
 * (@vapi-ai/web `reconnect`). With the call token in the browser, a visitor
 * could send assistantOverrides — longer calls, another prompt — and Vapi's
 * token restrictions can't forbid that. Here the only override is ours: the
 * voice.
 */
export async function createWebCall(assistantId: string, voice: DemoVoice): Promise<WebCallJoin | null> {
  const privateKey = process.env.VAPI_API_KEY?.trim();
  const orgId = process.env.VAPI_ORG_ID?.trim();
  if (!privateKey || !orgId) return null;
  const token = signDemoToken({ orgId, privateKey, assistantId, origins: [CALL_ORIGIN] });
  try {
    const res = await fetch("https://api.vapi.ai/call/web", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Origin: CALL_ORIGIN, "Content-Type": "application/json" },
      body: JSON.stringify({
        assistantId,
        ...(voice === "male" ? { assistantOverrides: { voice: voiceFor(MALE_VOICE) } } : {}),
        // Leaving the page ends the call; nothing keeps billing in an empty room.
        roomDeleteOnUserLeaveEnabled: true,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await res.json().catch(() => null)) as
      | { id?: string; webCallUrl?: string; transport?: { callUrl?: string; callToken?: string } }
      | null;
    const url = data?.webCallUrl ?? data?.transport?.callUrl;
    if (!res.ok || !data?.id || !url) {
      console.error(`[try-call] Vapi refused the web call: HTTP ${res.status}`);
      return null;
    }
    return { id: data.id, webCallUrl: url, ...(data.transport?.callToken ? { transport: { callToken: data.transport.callToken } } : {}) };
  } catch (e) {
    console.error("[try-call] could not reach Vapi:", e instanceof Error ? e.message : e);
    return null;
  }
}

function istanbulDayStart(now: Date): string {
  return new Date(`${new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(now)}T00:00:00+03:00`).toISOString();
}

/**
 * The durable, cross-instance cap (the in-memory rateLimit is per instance).
 * Counts today's starts (Istanbul day) and records this one if there's room.
 * Without Supabase there is no durable store — the call is refused, since an
 * uncapped paid endpoint is worse than a missing demo.
 */
export async function claimDemoCall(
  ip: string,
  trialId: string | null = null,
  voice: DemoVoice = "female",
  now: Date = new Date(),
): Promise<{ result: "ok" | "cap" | "ip_limit" | "trial_daily" | "error"; left?: number }> {
  const supabase = getSupabaseServer();
  if (!supabase) return { result: "error" };

  const dayStart = istanbulDayStart(now);
  const starts = () => supabase.from("demo_call_starts").select("id", { count: "exact", head: true });

  const ipHash = hashIp(ip);
  let left: number | undefined;
  if (trialId) {
    // A trial has its own allowance (its calls and days: trialStatus), outside the public cap.
    const today = await starts().eq("trial_id", trialId).gte("created_at", dayStart);
    if (today.error) {
      console.error("[try-call] trial count failed:", today.error.message);
      return { result: "error" };
    }
    if ((today.count ?? 0) >= TRIAL_CALLS_PER_DAY) return { result: "trial_daily" };
  } else {
    const [all, mine] = await Promise.all([
      starts().is("trial_id", null).gte("created_at", dayStart),
      starts().is("trial_id", null).eq("ip_hash", ipHash).gte("created_at", dayStart),
    ]);
    if (all.error || mine.error) {
      console.error("[try-call] count failed:", (all.error ?? mine.error)!.message);
      return { result: "error" };
    }
    if ((mine.count ?? 0) >= DEMO_CALLS_PER_IP_PER_DAY) return { result: "ip_limit", left: 0 };
    if ((all.count ?? 0) >= demoDailyCap()) return { result: "cap" };
    left = DEMO_CALLS_PER_IP_PER_DAY - (mine.count ?? 0) - 1;
  }

  const { error: insertError } = await supabase.from("demo_call_starts").insert({ ip_hash: ipHash, trial_id: trialId, voice });
  if (insertError) {
    console.error("[try-call] insert failed:", insertError.message);
    return { result: "error" };
  }
  return { result: "ok", left };
}

/** How many public demo calls this visitor has left today — shown before they start. */
export async function publicCallsLeft(ip: string, now: Date = new Date()): Promise<number | null> {
  const supabase = getSupabaseServer();
  if (!supabase) return null;
  const { count, error } = await supabase
    .from("demo_call_starts")
    .select("id", { count: "exact", head: true })
    .is("trial_id", null)
    .eq("ip_hash", hashIp(ip))
    .gte("created_at", istanbulDayStart(now));
  if (error) return null;
  return Math.max(0, DEMO_CALLS_PER_IP_PER_DAY - (count ?? 0));
}

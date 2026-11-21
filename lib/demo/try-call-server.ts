import { createHash, createHmac } from "node:crypto";
import appConfig from "@/app.config";
import { getSupabaseServer } from "@/lib/supabase/server";
import { demoDailyCap } from "@/lib/demo/try-call";
import { TRIAL_CALLS_PER_DAY, TRIAL_MAX_STARTS } from "@/lib/demo/trials";

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

/** Origins the call token is valid on — production only, plus localhost for a local test. */
export function allowedOrigins(): string[] {
  const origins = [`https://${appConfig.domain}`, `https://www.${appConfig.domain}`];
  if (process.env.NODE_ENV !== "production") origins.push("http://localhost:3000");
  return origins;
}

const b64url = (input: Buffer | string) => Buffer.from(input).toString("base64url");

/**
 * A short-lived public Vapi JWT that can start a web call on the demo
 * assistant only, from our own origin only (docs.vapi.ai/customization/jwt-authentication):
 * HS256, signed with the private API key, which never leaves this server.
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
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    orgId: opts.orgId,
    iat,
    exp: iat + (opts.ttlSeconds ?? 300),
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
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const signature = createHmac("sha256", opts.privateKey).update(unsigned).digest("base64url");
  return `${unsigned}.${signature}`;
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
  now: Date = new Date(),
): Promise<"ok" | "cap" | "trial_daily" | "trial_starts" | "error"> {
  const supabase = getSupabaseServer();
  if (!supabase) return "error";

  const dayStart = new Date(
    `${new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(now)}T00:00:00+03:00`,
  ).toISOString();
  const starts = () => supabase.from("demo_call_starts").select("id", { count: "exact", head: true });

  if (trialId) {
    // A trial has its own allowance, outside the public demo's daily cap.
    const [today, total] = await Promise.all([
      starts().eq("trial_id", trialId).gte("created_at", dayStart),
      starts().eq("trial_id", trialId),
    ]);
    if (today.error || total.error) {
      console.error("[try-call] trial count failed:", (today.error ?? total.error)!.message);
      return "error";
    }
    if ((today.count ?? 0) >= TRIAL_CALLS_PER_DAY) return "trial_daily";
    if ((total.count ?? 0) >= TRIAL_MAX_STARTS) return "trial_starts";
  } else {
    const { count, error } = await starts().is("trial_id", null).gte("created_at", dayStart);
    if (error) {
      console.error("[try-call] count failed:", error.message);
      return "error";
    }
    if ((count ?? 0) >= demoDailyCap()) return "cap";
  }

  const { error: insertError } = await supabase.from("demo_call_starts").insert({ ip_hash: hashIp(ip), trial_id: trialId });
  if (insertError) {
    console.error("[try-call] insert failed:", insertError.message);
    return "error";
  }
  return "ok";
}

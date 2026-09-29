import { createHmac, timingSafeEqual } from "node:crypto";
import type { ClinicContext } from "@/lib/clinics/server";

/**
 * The seam between Randevox and the automation app (Modal, `automation/app.py`,
 * Faz 3). Randevox owns everything that happens while a caller is on the
 * line; the automation app owns what happens after — SMS or WhatsApp to the
 * patient, email to the clinic, reminders. One shared app serves every
 * clinic: whatever a job needs to know about the clinic travels inside the
 * event, so it never holds the service-role key.
 *
 * Two directions, one secret (AUTOMATION_SECRET):
 * - Randevox → automation: `emitEvent` POSTs to AUTOMATION_EVENTS_URL, body
 *   signed with HMAC-SHA256 in `x-randevox-signature`.
 * - automation → Randevox: /api/automation/* routes check `Authorization: Bearer`.
 */

export type AutomationEventType = "call.completed" | "appointment.booked" | "appointment.cancelled" | "appointment.rescheduled";

function secret(): string | null {
  return process.env.AUTOMATION_SECRET?.trim() || null;
}

export function isAutomationConfigured(): boolean {
  return Boolean(process.env.AUTOMATION_EVENTS_URL?.trim() && secret());
}

export function signBody(body: string, key: string): string {
  return createHmac("sha256", key).update(body).digest("hex");
}

/** The clinic fields a workflow may need — never keys, never other clinics. */
function clinicForEvent(c: ClinicContext) {
  return {
    id: c.id,
    name: c.name,
    timeZone: c.timeZone,
    notifyEmail: c.notifyEmail,
    messageChannel: c.messageChannel,
    // Read by the automation app from before the SMS channel existed; kept for older events.
    whatsappEnabled: c.messageChannel === "whatsapp",
  };
}

/**
 * Best-effort, like forwardToWebhook in lib/actions/executors/crm.ts: 5 s
 * timeout, never throws. The database is the source of truth; a lost event
 * costs a message, never a record. Returns whether the automation app accepted it.
 */
export async function emitEvent(
  clinic: ClinicContext | null,
  type: AutomationEventType,
  data: Record<string, unknown>,
): Promise<boolean> {
  const url = process.env.AUTOMATION_EVENTS_URL?.trim();
  const key = secret();
  // No clinic means demo mode — nothing real happened, so nothing to tell anyone.
  if (!url || !key || !clinic) return false;

  const body = JSON.stringify({
    source: "randevox",
    type,
    sentAt: new Date().toISOString(),
    clinic: clinicForEvent(clinic),
    data,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-randevox-signature": signBody(body, key) },
      body,
      signal: controller.signal,
    });
    if (!res.ok) console.error(`[automation] rejected ${type}: HTTP ${res.status}`);
    return res.ok;
  } catch (e) {
    console.error(`[automation] could not reach automation app for ${type}:`, e instanceof Error ? e.message : e);
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Gate for the routes the automation app calls. Fails closed: with no
 * AUTOMATION_SECRET configured nothing gets in — same stance as /api/cron/crm-sync.
 */
export function isAutomationRequest(req: Request): boolean {
  const key = secret();
  if (!key) return false;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${key}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

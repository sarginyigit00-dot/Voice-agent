import { NextResponse } from "next/server";
import { runAgentActions } from "@/lib/actions/run";
import type { ActionId } from "@/lib/actions/registry";
import { ACTION_IDS } from "@/lib/actions/registry";
import type { CallActionPayload } from "@/lib/actions/types";
import { calcomConfig, getSlots, toInstant } from "@/lib/calcom/client";
import { requireUser } from "@/lib/auth/require-user";

/**
 * Settings → Integrations → "Test webhook" button hits this route with a
 * fake call so a user can confirm their CRM_WEBHOOK_URL actually receives
 * data (e.g. in webhook.site) without needing a real phone call — demo mode
 * never produces a live call to trigger the real pipeline (app/api/vapi/webhook).
 *
 * Requires a signed-in Supabase session: this route can fire a genuine
 * Cal.com booking and a genuine CRM webhook call, so it must never be
 * reachable by an anonymous caller — it used to be, and anyone who found the
 * URL could spam real bookings and burn API quota on someone else's keys.
 */
/**
 * The next slot Cal.com actually reports as free, within a week.
 *
 * Guessing "tomorrow at 10:00" doesn't work — tomorrow might be a day the
 * clinic's calendar has no hours for at all (a weekend, a holiday), and
 * `book`'s post-call executor never checks availability before booking (its
 * mid-call counterpart in lib/booking/tools.ts does; this is the fallback
 * path, not the primary one). A guessed slot on a closed day gets a real,
 * correct 409 from Cal.com — this just picks a slot that won't.
 */
async function nextAvailableSlot(): Promise<string> {
  const cfg = calcomConfig();
  const timeZone = cfg?.timeZone ?? "Europe/Istanbul";
  const fallback = toInstant(
    new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
      new Date(Date.now() + 24 * 60 * 60 * 1000),
    ) + "T10:00:00",
    timeZone,
  );

  if (!cfg) return (fallback ?? new Date(Date.now() + 24 * 60 * 60 * 1000)).toISOString();

  const slots = await getSlots(cfg, { start: new Date(), end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) });
  const first = slots.ok ? slots.data.find((s) => Date.parse(s) > Date.now()) : undefined;
  return first ?? (fallback ?? new Date(Date.now() + 24 * 60 * 60 * 1000)).toISOString();
}

export async function POST(req: Request) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ status: "error", note: "Oturum gerekli." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const actionId: ActionId = ACTION_IDS.includes(body.actionId) ? body.actionId : "crm";

  const payload: CallActionPayload = {
    callId: `test-${Date.now()}`,
    agentId: "ag1",
    agentName: "Reception",
    caller: "Test Caller",
    number: "+1 (415) 555-0100",
    startedAt: new Date().toISOString(),
    // The post-call `book` net refuses to book without a slot (it no longer
    // falls back to the call's own start time, which is always in the past),
    // so the test supplies one to exercise the whole path. Note this only
    // covers the safety net — real bookings go through the mid-call tools in
    // lib/booking/tools.ts, which need a live call to fire.
    requestedStart: await nextAvailableSlot(),
    sentiment: "neutral",
    durationSec: 42,
    outcome: "booked",
    summary: "Bu, Ayarlar sayfasından tetiklenen bir test aramasıdır.",
    transcript: [
      { speaker: "agent", text: "Merhaba, size nasıl yardımcı olabilirim?", atSec: 0 },
      { speaker: "caller", text: "Bu bir test mesajıdır.", atSec: 4 },
    ],
  };

  const [result] = await runAgentActions([actionId], payload);
  return NextResponse.json(result, { status: result.status === "error" ? 502 : 200 });
}

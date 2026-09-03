import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * Local record of every appointment the agent books, keyed by the call it came
 * from (`appointments` in supabase/schema.sql).
 *
 * It exists for two reasons beyond having the data at hand:
 *
 * 1. **Idempotency.** Vapi retries a webhook it didn't get a 200 from, and the
 *    post-call `book` executor would otherwise book the same patient twice.
 *    `call_id` is uniquely indexed, so `findByCall` is the guard.
 * 2. **Handover.** The mid-call tool books the slot; the end-of-call report
 *    arrives seconds later on a different request with no shared memory. This
 *    table is how the second one learns the first already succeeded.
 */

export interface AppointmentRecord {
  callId: string;
  bookingUid: string;
  startsAt: string;
  attendeeName: string;
  attendeeEmail: string | null;
  attendeePhone: string | null;
  agentId: string | null;
  source: "in-call" | "post-call";
}

/** The appointment already booked for this call, if any. */
export async function findByCall(callId: string): Promise<AppointmentRecord | null> {
  const supabase = getSupabaseServer();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .eq("call_id", callId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    callId: data.call_id,
    bookingUid: data.booking_uid,
    startsAt: data.starts_at,
    attendeeName: data.attendee_name,
    attendeeEmail: data.attendee_email,
    attendeePhone: data.attendee_phone,
    agentId: data.agent_id,
    source: data.source,
  };
}

/**
 * Best-effort persist. A failure here must never fail the caller: the booking
 * itself already exists on Cal.com by this point, and losing our local copy is
 * far better than telling a patient on the phone that it didn't work.
 */
export async function record(appointment: AppointmentRecord): Promise<void> {
  const supabase = getSupabaseServer();
  if (!supabase) return;

  const { error } = await supabase.from("appointments").upsert(
    {
      call_id: appointment.callId,
      booking_uid: appointment.bookingUid,
      starts_at: appointment.startsAt,
      attendee_name: appointment.attendeeName,
      attendee_email: appointment.attendeeEmail,
      attendee_phone: appointment.attendeePhone,
      agent_id: appointment.agentId,
      source: appointment.source,
    },
    { onConflict: "call_id" },
  );

  if (error) console.error("[appointments] failed to record booking:", error.message);
}

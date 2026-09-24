import { getSupabaseServer } from "@/lib/supabase/server";
import { calcomConfigFor, cancelBooking, rescheduleBooking } from "@/lib/calcom/client";
import { emitEvent } from "@/lib/automation/emit";
import { localParts } from "@/lib/automation/format";
import { toE164 } from "@/lib/vapi/client";
import type { ClinicContext } from "@/lib/clinics/server";

/**
 * Cancelling and moving an appointment — one implementation for both doors:
 * the /randevular panel (app/api/appointments/*) and the phone line
 * (lib/booking/tools.ts, when a patient calls to cancel or reschedule).
 *
 * Order is the same for both, and it matters: Cal.com first, our row second.
 * Flipping our own row first would leave a patient holding an appointment the
 * clinic believes is gone.
 */

export interface ManagedAppointment {
  id: string;
  booking_uid: string;
  status: string;
  starts_at: string;
  attendee_name: string;
  attendee_phone: string | null;
}

export type ManageResult =
  | { ok: true; alreadyCancelled?: boolean; warning?: string; startsAt?: string; bookingUid?: string }
  | { ok: false; status: number; error: string };

const COLUMNS = "id, booking_uid, status, starts_at, attendee_name, attendee_phone";

/** One of THIS clinic's appointments. The service-role client bypasses RLS, so the clinic filter is the boundary. */
export async function appointmentFor(clinic: ClinicContext, id: string): Promise<ManagedAppointment | null> {
  const supabase = getSupabaseServer();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("appointments")
    .select(COLUMNS)
    .eq("id", id)
    .eq("clinic_id", clinic.id)
    .maybeSingle();
  if (error || !data) return null;
  return data as ManagedAppointment;
}

/** This clinic's booked appointments starting in [from, to). */
export async function upcomingFor(clinic: ClinicContext, from: Date, to: Date): Promise<ManagedAppointment[]> {
  const supabase = getSupabaseServer();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("appointments")
    .select(COLUMNS)
    .eq("clinic_id", clinic.id)
    .eq("status", "booked")
    .gte("starts_at", from.toISOString())
    .lt("starts_at", to.toISOString())
    .order("starts_at", { ascending: true })
    .limit(50);
  if (error) {
    console.error("[appointments] upcoming lookup failed:", error.message);
    return [];
  }
  return (data ?? []) as ManagedAppointment[];
}

export async function cancelAppointment(
  clinic: ClinicContext,
  appointment: ManagedAppointment,
  /** Who did it — shown as the Cal.com reason and sent with the event. */
  by: string,
): Promise<ManageResult> {
  // Already cancelled — success, so a double click (or a repeated tool call) isn't an error.
  if (appointment.status === "cancelled") return { ok: true, alreadyCancelled: true };

  const supabase = getSupabaseServer();
  if (!supabase) return { ok: false, status: 503, error: "Supabase yapılandırılmamış." };
  const cfg = await calcomConfigFor(clinic);
  if (!cfg) return { ok: false, status: 503, error: "Cal.com yapılandırılmamış." };

  const cancelled = await cancelBooking(cfg, appointment.booking_uid, `İptal eden: ${by}`);
  if (!cancelled.ok) {
    console.error("[appointments] Cal.com cancel failed:", cancelled.error);
    return { ok: false, status: 502, error: cancelled.error };
  }

  const { error: writeError } = await supabase
    .from("appointments")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", appointment.id)
    .eq("clinic_id", clinic.id);

  if (writeError) {
    // Cal.com is already cancelled, so the appointment really is gone — say so
    // rather than reporting a failure that would be retried forever.
    console.error("[appointments] cancelled on Cal.com but local update failed:", writeError.message);
    return { ok: true, warning: "Takvimde iptal edildi, ancak panel kaydı güncellenemedi." };
  }

  await emitEvent(clinic, "appointment.cancelled", {
    id: appointment.id,
    startsAt: appointment.starts_at,
    ...localParts(appointment.starts_at, clinic.timeZone),
    attendeeName: appointment.attendee_name,
    phone: appointment.attendee_phone ? toE164(appointment.attendee_phone) : null,
    by,
  });

  return { ok: true };
}

export async function rescheduleAppointment(
  clinic: ClinicContext,
  appointment: ManagedAppointment,
  newStart: Date,
  by: string,
): Promise<ManageResult> {
  if (appointment.status === "cancelled") {
    return { ok: false, status: 409, error: "İptal edilmiş bir randevu ertelenemez." };
  }
  if (newStart.getTime() <= Date.now()) return { ok: false, status: 400, error: "Yeni saat geçmişte olamaz." };

  const supabase = getSupabaseServer();
  if (!supabase) return { ok: false, status: 503, error: "Supabase yapılandırılmamış." };
  const cfg = await calcomConfigFor(clinic);
  if (!cfg) return { ok: false, status: 503, error: "Cal.com yapılandırılmamış." };

  // Cal.com doesn't move a booking in place: it returns a NEW uid, and the old one is superseded.
  const rescheduled = await rescheduleBooking(cfg, appointment.booking_uid, newStart, `Erteleyen: ${by}`);
  if (!rescheduled.ok) {
    console.error("[appointments] Cal.com reschedule failed:", rescheduled.error);
    return { ok: false, status: 502, error: rescheduled.error };
  }

  const { error: writeError } = await supabase
    .from("appointments")
    .update({
      booking_uid: rescheduled.data.uid,
      starts_at: newStart.toISOString(),
      // A new time is a new appointment as far as reminders go.
      reminder_24h_sent_at: null,
      reminder_2h_sent_at: null,
    })
    .eq("id", appointment.id)
    .eq("clinic_id", clinic.id);

  if (writeError) {
    // Cal.com already moved it — the reschedule genuinely happened, our local mirror just failed to catch up.
    console.error("[appointments] rescheduled on Cal.com but local update failed:", writeError.message);
    return { ok: true, warning: "Takvimde ertelendi, ancak panel kaydı güncellenemedi." };
  }

  await emitEvent(clinic, "appointment.rescheduled", {
    id: appointment.id,
    previousStartsAt: appointment.starts_at,
    startsAt: newStart.toISOString(),
    ...localParts(newStart.toISOString(), clinic.timeZone),
    attendeeName: appointment.attendee_name,
    phone: appointment.attendee_phone ? toE164(appointment.attendee_phone) : null,
    by,
  });

  return { ok: true, startsAt: newStart.toISOString(), bookingUid: rescheduled.data.uid };
}

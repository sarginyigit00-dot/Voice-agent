import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { calcomConfigFor, rescheduleBooking, toInstant } from "@/lib/calcom/client";
import { requireMember } from "@/lib/clinics/server";
import { emitEvent } from "@/lib/automation/emit";
import { localParts } from "@/lib/automation/format";
import { toE164 } from "@/lib/vapi/client";

/**
 * Reschedules an appointment from /randevular. Staff-only, panel-side —
 * there is no phone-call counterpart to this (a caller reaching a live agent
 * to move their own appointment is a separate, larger piece of work; see the
 * plan this shipped under).
 *
 * Same shape as /api/appointments/cancel, and the same reason it needs
 * requireUser: this route holds the service-role key.
 *
 * Cal.com doesn't move a booking in place — `rescheduleBooking` gets back a
 * BRAND NEW uid (the old one is superseded, not mutated), so the local row
 * updates its `booking_uid` too, not just `starts_at`. Cal.com first, our row
 * second — same ordering as cancel, for the same reason: never tell the
 * clinic a slot changed if it didn't actually change on the real calendar.
 */
export async function POST(req: Request) {
  const member = await requireMember(req);
  if (!member.ok) return NextResponse.json({ error: member.error }, { status: member.status });
  const { user, clinic } = member;

  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış." }, { status: 503 });
  }

  const cfg = await calcomConfigFor(clinic);
  if (!cfg) {
    return NextResponse.json({ error: "Cal.com yapılandırılmamış." }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : null;
  const rawStart = typeof body?.start === "string" ? body.start : null;
  if (!id || !rawStart) {
    return NextResponse.json({ error: "Randevu kimliği veya yeni saat eksik." }, { status: 400 });
  }

  const newStart = toInstant(rawStart, cfg.timeZone);
  if (!newStart) {
    return NextResponse.json({ error: "Yeni saat okunamadı." }, { status: 400 });
  }
  if (newStart.getTime() <= Date.now()) {
    return NextResponse.json({ error: "Yeni saat geçmişte olamaz." }, { status: 400 });
  }

  const { data: appointment, error: readError } = await supabase
    .from("appointments")
    .select("id, booking_uid, status, starts_at, attendee_name, attendee_phone")
    .eq("id", id)
    // Scoped to the caller's clinic — see the same line in ../cancel/route.ts.
    .eq("clinic_id", clinic.id)
    .maybeSingle();

  if (readError || !appointment) {
    return NextResponse.json({ error: "Randevu bulunamadı." }, { status: 404 });
  }
  if (appointment.status === "cancelled") {
    return NextResponse.json({ error: "İptal edilmiş bir randevu ertelenemez." }, { status: 409 });
  }

  const rescheduled = await rescheduleBooking(
    cfg,
    appointment.booking_uid,
    newStart,
    `Erteleyen: ${user.email ?? "panel"}`,
  );
  if (!rescheduled.ok) {
    console.error("[appointments] Cal.com reschedule failed:", rescheduled.error);
    return NextResponse.json({ error: rescheduled.error }, { status: 502 });
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
    .eq("id", id)
    .eq("clinic_id", clinic.id);

  if (writeError) {
    // Cal.com already moved the appointment — the reschedule genuinely
    // happened, our local mirror just failed to catch up.
    console.error("[appointments] rescheduled on Cal.com but local update failed:", writeError.message);
    return NextResponse.json({
      ok: true,
      warning: "Takvimde ertelendi, ancak panel kaydı güncellenemedi.",
    });
  }

  await emitEvent(clinic, "appointment.rescheduled", {
    id,
    previousStartsAt: appointment.starts_at,
    startsAt: newStart.toISOString(),
    ...localParts(newStart.toISOString(), clinic.timeZone),
    attendeeName: appointment.attendee_name,
    phone: appointment.attendee_phone ? toE164(appointment.attendee_phone) : null,
    by: user.email ?? null,
  });

  return NextResponse.json({ ok: true, startsAt: newStart.toISOString(), bookingUid: rescheduled.data.uid });
}

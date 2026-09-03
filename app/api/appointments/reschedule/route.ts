import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { calcomConfig, rescheduleBooking, toInstant } from "@/lib/calcom/client";
import { requireUser } from "@/lib/auth/require-user";

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
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });

  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış." }, { status: 503 });
  }

  const cfg = calcomConfig();
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
    .select("id, booking_uid, status")
    .eq("id", id)
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
    .update({ booking_uid: rescheduled.data.uid, starts_at: newStart.toISOString() })
    .eq("id", id);

  if (writeError) {
    // Cal.com already moved the appointment — the reschedule genuinely
    // happened, our local mirror just failed to catch up.
    console.error("[appointments] rescheduled on Cal.com but local update failed:", writeError.message);
    return NextResponse.json({
      ok: true,
      warning: "Takvimde ertelendi, ancak panel kaydı güncellenemedi.",
    });
  }

  return NextResponse.json({ ok: true, startsAt: newStart.toISOString(), bookingUid: rescheduled.data.uid });
}

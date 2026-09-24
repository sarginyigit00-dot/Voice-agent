import { NextResponse } from "next/server";
import { calcomConfigFor, toInstant } from "@/lib/calcom/client";
import { requireMember } from "@/lib/clinics/server";
import { appointmentFor, rescheduleAppointment } from "@/lib/appointments/manage";

/**
 * Reschedules an appointment from /randevular. Staff-only, panel-side; the
 * phone line reaches the same code through lib/booking/tools.ts.
 *
 * Same shape as /api/appointments/cancel, and the same reason it needs a
 * signed-in member: this route holds the service-role key. The move itself
 * (Cal.com first — which hands back a NEW booking uid — then our row) lives in
 * lib/appointments/manage.ts.
 */
export async function POST(req: Request) {
  const member = await requireMember(req);
  if (!member.ok) return NextResponse.json({ error: member.error }, { status: member.status });
  const { user, clinic } = member;

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

  // Scoped to the caller's clinic — see the same line in ../cancel/route.ts.
  const appointment = await appointmentFor(clinic, id);
  if (!appointment) {
    return NextResponse.json({ error: "Randevu bulunamadı." }, { status: 404 });
  }

  const result = await rescheduleAppointment(clinic, appointment, newStart, user.email ?? "panel");
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}

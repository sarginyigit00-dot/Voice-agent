import { NextResponse } from "next/server";
import { requireMember } from "@/lib/clinics/server";
import { appointmentFor, cancelAppointment } from "@/lib/appointments/manage";

/**
 * Cancels an appointment from /randevular.
 *
 * This route holds the service-role key, which bypasses RLS — so unlike the
 * browser-side reads it cannot trust its caller. Every request must carry the
 * signed-in user's access token, which we verify against Supabase Auth before
 * touching anything. The cancel itself (Cal.com first, our row second) lives
 * in lib/appointments/manage.ts, shared with the phone line.
 */
export async function POST(req: Request) {
  const member = await requireMember(req);
  if (!member.ok) return NextResponse.json({ error: member.error }, { status: member.status });
  const { user, clinic } = member;

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : null;
  if (!id) {
    return NextResponse.json({ error: "Randevu kimliği eksik." }, { status: 400 });
  }

  // Scoped to the caller's clinic: another clinic's id reads as "not found", never as cancellable.
  const appointment = await appointmentFor(clinic, id);
  if (!appointment) {
    return NextResponse.json({ error: "Randevu bulunamadı." }, { status: 404 });
  }

  const result = await cancelAppointment(clinic, appointment, user.email ?? "panel");
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}

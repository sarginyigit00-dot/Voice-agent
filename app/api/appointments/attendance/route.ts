import { NextResponse } from "next/server";
import { requireMember } from "@/lib/clinics/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { appointmentFor } from "@/lib/appointments/manage";

/**
 * Marks whether the patient showed up — "completed" (geldi), "no_show"
 * (gelmedi), or "booked" to undo a mistake. Panel-only and local-only: unlike
 * cancel/reschedule this never touches Cal.com, the calendar slot has already
 * passed. Same rule as the sibling routes: the service-role key bypasses RLS,
 * so the caller must be a member and the row must belong to their clinic.
 */
const MARKS = ["completed", "no_show", "booked"] as const;
type Mark = (typeof MARKS)[number];

export async function POST(req: Request) {
  const member = await requireMember(req);
  if (!member.ok) return NextResponse.json({ error: member.error }, { status: member.status });
  const { clinic } = member;

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : null;
  const status = MARKS.find((m) => m === body?.status) as Mark | undefined;
  if (!id || !status) {
    return NextResponse.json({ error: "Randevu kimliği veya durum eksik." }, { status: 400 });
  }

  const appointment = await appointmentFor(clinic, id);
  if (!appointment) {
    return NextResponse.json({ error: "Randevu bulunamadı." }, { status: 404 });
  }
  if (appointment.status === "cancelled") {
    return NextResponse.json({ error: "İptal edilmiş randevu işaretlenemez." }, { status: 409 });
  }
  if (Date.parse(appointment.starts_at) > Date.now()) {
    return NextResponse.json({ error: "Randevu saati henüz gelmedi." }, { status: 409 });
  }

  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ error: "Supabase yapılandırılmamış." }, { status: 503 });

  const { error } = await supabase
    .from("appointments")
    .update({ status })
    .eq("id", appointment.id)
    .eq("clinic_id", clinic.id);
  if (error) {
    console.error("[appointments] attendance update failed:", error.message);
    return NextResponse.json({ error: "Durum kaydedilemedi." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, status });
}

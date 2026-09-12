import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { calcomConfigFor, cancelBooking } from "@/lib/calcom/client";
import { requireMember } from "@/lib/clinics/server";

/**
 * Cancels an appointment from /randevular.
 *
 * This route holds the service-role key, which bypasses RLS — so unlike the
 * browser-side reads it cannot trust its caller. Every request must carry the
 * signed-in user's access token, which we verify against Supabase Auth before
 * touching anything.
 *
 * Order matters: Cal.com is cancelled FIRST, and only on success do we mark
 * the local row. Flipping our own row first would leave a patient holding an
 * appointment the clinic believes is gone.
 */
export async function POST(req: Request) {
  const member = await requireMember(req);
  if (!member.ok) return NextResponse.json({ error: member.error }, { status: member.status });
  const { user, clinic } = member;

  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase yapılandırılmamış." }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : null;
  if (!id) {
    return NextResponse.json({ error: "Randevu kimliği eksik." }, { status: 400 });
  }

  const { data: appointment, error: readError } = await supabase
    .from("appointments")
    .select("id, booking_uid, status")
    .eq("id", id)
    // Scoped to the caller's clinic: this client bypasses RLS, and another
    // clinic's appointment id must read as "not found", never as cancellable.
    .eq("clinic_id", clinic.id)
    .maybeSingle();

  if (readError || !appointment) {
    return NextResponse.json({ error: "Randevu bulunamadı." }, { status: 404 });
  }
  if (appointment.status === "cancelled") {
    // Already cancelled — treat as success so a double click isn't an error.
    return NextResponse.json({ ok: true, alreadyCancelled: true });
  }

  const cfg = await calcomConfigFor(clinic);
  if (!cfg) {
    return NextResponse.json({ error: "Cal.com yapılandırılmamış." }, { status: 503 });
  }

  const cancelled = await cancelBooking(cfg, appointment.booking_uid, `İptal eden: ${user.email ?? "panel"}`);
  if (!cancelled.ok) {
    console.error("[appointments] Cal.com cancel failed:", cancelled.error);
    return NextResponse.json({ error: cancelled.error }, { status: 502 });
  }

  const { error: writeError } = await supabase
    .from("appointments")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", id)
    .eq("clinic_id", clinic.id);

  if (writeError) {
    // Cal.com is already cancelled, so the appointment really is gone — say so
    // rather than reporting a failure the user would retry forever.
    console.error("[appointments] cancelled on Cal.com but local update failed:", writeError.message);
    return NextResponse.json({
      ok: true,
      warning: "Takvimde iptal edildi, ancak panel kaydı güncellenemedi.",
    });
  }

  return NextResponse.json({ ok: true });
}

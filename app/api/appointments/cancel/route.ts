import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { calcomConfig, cancelBooking } from "@/lib/calcom/client";
import { requireUser } from "@/lib/auth/require-user";

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
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });

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
    .maybeSingle();

  if (readError || !appointment) {
    return NextResponse.json({ error: "Randevu bulunamadı." }, { status: 404 });
  }
  if (appointment.status === "cancelled") {
    // Already cancelled — treat as success so a double click isn't an error.
    return NextResponse.json({ ok: true, alreadyCancelled: true });
  }

  const cfg = calcomConfig();
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
    .eq("id", id);

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

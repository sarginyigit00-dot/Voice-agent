import { NextResponse } from "next/server";
import { requireMember } from "@/lib/clinics/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { recordingLinkFor } from "@/lib/vapi/client";

export const dynamic = "force-dynamic";

/**
 * GET → { url } — a fresh, 30-minute link to one call's recording, for the
 * transcript drawer's player (lib/vapi/client.ts → recordingLinkFor says why
 * the link can't simply be stored).
 *
 * The call id comes from the browser, so it is checked against the caller's
 * own clinic before Vapi is asked anything: without that, any signed-in user
 * could play any clinic's patients by guessing ids.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const member = await requireMember(req);
  if (!member.ok) return NextResponse.json({ error: member.error }, { status: member.status });

  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ error: "Supabase bağlı değil." }, { status: 503 });

  const { id } = await ctx.params;
  const { data: row, error } = await supabase
    .from("calls")
    .select("id")
    .eq("id", id)
    .eq("clinic_id", member.clinic.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: "Arama bulunamadı." }, { status: 404 });

  const link = await recordingLinkFor(id);
  if (!link.ok) return NextResponse.json({ error: `Vapi: ${link.error}` }, { status: 502 });
  if (!link.data) return NextResponse.json({ error: "Bu aramanın ses kaydı yok." }, { status: 404 });

  return NextResponse.json({ url: link.data }, { headers: { "Cache-Control": "no-store" } });
}

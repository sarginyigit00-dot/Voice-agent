import { NextResponse } from "next/server";
import { requireMember } from "@/lib/clinics/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { supportEmail } from "@/lib/admin/support";
import { contractFor, recordAcceptance } from "@/lib/contracts/server";

export const dynamic = "force-dynamic";

const isSupport = (email: string | null) => {
  const s = supportEmail();
  return !!s && email?.toLowerCase() === s;
};

/** The caller's clinic's contracts and whether they still need accepting (components/app/contract-gate.tsx). */
export async function GET(req: Request) {
  const member = await requireMember(req);
  if (!member.ok) return NextResponse.json({ error: member.error }, { status: member.status });
  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ error: "Supabase bağlı değil." }, { status: 500 });

  try {
    const state = await contractFor(supabase, member.clinic.id);
    // The reason names env vars — operator detail, not the clinic's business.
    const body = state.status === "none" ? { status: "none" } : state;
    return NextResponse.json({ ...body, support: isSupport(member.user.email) });
  } catch (e) {
    console.error("[contract] read failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Sözleşme okunamadı." }, { status: 500 });
  }
}

/** POST { digest, accept: true, authorized: true } — the two ticks and the button. */
export async function POST(req: Request) {
  const member = await requireMember(req);
  if (!member.ok) return NextResponse.json({ error: member.error }, { status: member.status });
  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ error: "Supabase bağlı değil." }, { status: 500 });

  // The operator in "Panelini aç" must never accept on the clinic's behalf.
  if (isSupport(member.user.email)) {
    return NextResponse.json({ error: "Destek modunda sözleşme kabul edilemez." }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (body?.accept !== true || body?.authorized !== true || typeof body?.digest !== "string") {
    return NextResponse.json({ error: "İki kutunun da işaretlenmesi gerekir." }, { status: 400 });
  }

  const result = await recordAcceptance({
    supabase,
    clinicId: member.clinic.id,
    clinicName: member.clinic.name,
    method: "click",
    digest: body.digest,
    user: member.user,
    req,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}

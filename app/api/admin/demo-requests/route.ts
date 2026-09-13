import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { getSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * POST { action: "delete", id } — removes one demo request.
 *
 * Same cookie gate as the rest of /admin: this route holds the service-role
 * key, and `demo_requests` has no RLS policies at all, so nothing but this
 * check stands between a request and the lead list. "Delete" means delete —
 * someone who asks to be removed is actually removed.
 */
export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { id?: unknown; action?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  if (body?.action !== "delete" || !id) {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Supabase bağlı değil." }, { status: 400 });
  }

  const { error } = await supabase.from("demo_requests").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, message: "Demo talebi silindi." });
}

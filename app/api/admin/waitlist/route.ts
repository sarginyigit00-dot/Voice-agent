import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { getSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * POST { action: "delete", id } — removes one address from the waitlist.
 *
 * Same cookie gate as the rest of /admin: this route holds the service-role
 * key, and `waitlist_emails` has no RLS policies at all, so nothing but this
 * check stands between a request and the lead list.
 *
 * "Delete" here means delete — someone who asks to come off the list should
 * actually come off it, not get a hidden flag.
 */
export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  let id: string | undefined;
  let action: string | undefined;
  try {
    const body = (await request.json()) as { id?: unknown; action?: unknown };
    id = typeof body.id === "string" ? body.id : undefined;
    action = typeof body.action === "string" ? body.action : undefined;
  } catch {
    // Falls through to the validation error below.
  }

  if (action !== "delete" || !id) {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Supabase bağlı değil." }, { status: 400 });
  }

  const { error } = await supabase.from("waitlist_emails").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, message: "Ön kayıt listeden çıkarıldı." });
}

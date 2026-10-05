import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { getSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** POST { action: "set-status", id, status } | { action: "delete", id } — the /admin feedback inbox. */
export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | { id?: unknown; action?: unknown; status?: unknown }
    | null;
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });

  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ ok: false, message: "Supabase bağlı değil." }, { status: 400 });

  if (body?.action === "set-status") {
    const status = body.status;
    if (status !== "new" && status !== "read" && status !== "done") {
      return NextResponse.json({ error: "Geçersiz durum." }, { status: 400 });
    }
    const { error } = await supabase.from("feedback").update({ status }).eq("id", id);
    if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, message: "Durum güncellendi." });
  }

  if (body?.action === "delete") {
    const { data } = await supabase.from("feedback").select("attachment_path").eq("id", id).maybeSingle();
    if (data?.attachment_path) {
      await supabase.storage.from("feedback-attachments").remove([data.attachment_path as string]);
    }
    const { error } = await supabase.from("feedback").delete().eq("id", id);
    if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, message: "Mesaj silindi." });
  }

  return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
}

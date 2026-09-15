import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { isAutomationRequest } from "@/lib/automation/emit";
import { REMINDER_WINDOWS, isReminderKind } from "@/lib/automation/reminders";

/**
 * n8n marks a reminder as sent: POST { id, kind }. The `is null` guard makes
 * it idempotent — a retried call changes nothing, and the row has already
 * left /api/automation/due-reminders, so the patient never gets it twice.
 */
export async function POST(req: Request) {
  if (!isAutomationRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : null;
  const kind = body?.kind;
  if (!id || !isReminderKind(kind)) {
    return NextResponse.json({ error: "id ve kind (24h | 2h) gerekli." }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ error: "Supabase yapılandırılmamış." }, { status: 503 });

  const column = REMINDER_WINDOWS[kind].column;
  const { data, error } = await supabase
    .from("appointments")
    .update({ [column]: new Date().toISOString() })
    .eq("id", id)
    .is(column, null)
    .select("id");

  if (error) {
    console.error("[automation] marking reminder sent failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, updated: (data ?? []).length > 0 });
}

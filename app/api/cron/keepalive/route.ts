import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Supabase free tier pauses a project after 7 days without activity. This
 * route runs a one-row read on a schedule (see vercel.json) so the project
 * always counts as active. Returns nothing sensitive, so no auth is needed.
 */
export async function GET() {
  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ status: "skipped" });

  const { error } = await supabase.from("crm_records").select("call_id").limit(1);
  if (error) return NextResponse.json({ status: "error" }, { status: 500 });
  return NextResponse.json({ status: "ok" });
}

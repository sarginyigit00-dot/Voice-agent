import { getSupabaseServer } from "@/lib/supabase/server";
import type { CrmRecord } from "@/lib/crm/types";

/** Most recent CRM records, newest first. Returns [] when Supabase isn't configured (demo mode). */
export async function listCrmRecords(limit = 100): Promise<CrmRecord[]> {
  const supabase = getSupabaseServer();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("crm_records")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[crm] failed to list crm_records:", error.message);
    return [];
  }
  return (data ?? []) as CrmRecord[];
}

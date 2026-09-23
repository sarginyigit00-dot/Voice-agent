import { getSupabaseServer } from "@/lib/supabase/server";
import type { CrmRecord } from "@/lib/crm/types";
import { cleanTranscript } from "@/lib/calls/transcript";

/**
 * One clinic's most recent CRM records, newest first. Returns [] when Supabase
 * isn't configured (demo mode). Reads with the service-role key, so the
 * clinic filter below is the whole of the tenant boundary here.
 */
export async function listCrmRecords(clinicId: string, limit = 100): Promise<CrmRecord[]> {
  const supabase = getSupabaseServer();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("crm_records")
    .select("*")
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[crm] failed to list crm_records:", error.message);
    return [];
  }
  // Records copied before cleanTranscript still hold Vapi's raw rows.
  return ((data ?? []) as CrmRecord[]).map((r) => ({ ...r, transcript: cleanTranscript(r.transcript) }));
}

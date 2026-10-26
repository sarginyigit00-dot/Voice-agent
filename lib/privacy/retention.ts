import { getSupabaseServer } from "@/lib/supabase/server";
import { deleteCall, isVapiConfigured } from "@/lib/vapi/client";

/**
 * Retention policy, run nightly by app/api/cron/retention. The less patient
 * data is kept, the less a breach exposes — and these periods are what the
 * privacy page and the data-processing agreement promise.
 *
 * - After RECORDING_DAYS the call is deleted on Vapi, which takes the only
 *   copy of the recording with it (the panel fetches it from Vapi on demand,
 *   see recordingLinkFor).
 * - After TRANSCRIPT_DAYS the call row keeps only what the reports count
 *   (date, duration, outcome, sentiment): transcript, summary, name and
 *   number are wiped. CRM records and callback leads are deleted.
 *
 * Appointments are left alone: the clinic's calendar needs them.
 */

export const RECORDING_DAYS = 90;
export const TRANSCRIPT_DAYS = 365;

/** Vapi deletions per run — each is one HTTP call; the rest wait for tomorrow. */
const VAPI_BATCH = 50;

export interface RetentionResult {
  status: "ok" | "partial" | "skipped";
  recordingsDeleted: number;
  callsAnonymised: number;
  crmRecordsDeleted: number;
  leadsDeleted: number;
  errors: string[];
}

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

export async function runRetention(): Promise<RetentionResult> {
  const result: RetentionResult = {
    status: "ok",
    recordingsDeleted: 0,
    callsAnonymised: 0,
    crmRecordsDeleted: 0,
    leadsDeleted: 0,
    errors: [],
  };
  const supabase = getSupabaseServer();
  if (!supabase) return { ...result, status: "skipped" };

  // 1. Recordings: delete the call on Vapi, then mark the row so it isn't retried.
  if (isVapiConfigured()) {
    const { data: due, error } = await supabase
      .from("calls")
      .select("id")
      .lt("started_at", daysAgo(RECORDING_DAYS))
      .is("vapi_purged_at", null)
      .order("started_at")
      .limit(VAPI_BATCH);
    if (error) result.errors.push(`calls okunamadı: ${error.message}`);

    for (const { id } of due ?? []) {
      // Rows Vapi never knew (a failed webhook's "unknown") have nothing to delete there.
      const res = id === "unknown" ? ({ ok: true } as const) : await deleteCall(id);
      if (!res.ok) {
        result.errors.push(`Vapi ${id}: ${res.error}`);
        continue;
      }
      const { error: markError } = await supabase
        .from("calls")
        .update({ vapi_purged_at: new Date().toISOString(), recording_url: null })
        .eq("id", id);
      if (markError) result.errors.push(`calls ${id}: ${markError.message}`);
      else result.recordingsDeleted++;
    }
  }

  // 2. Transcripts and caller details on call rows.
  const cutoff = daysAgo(TRANSCRIPT_DAYS);
  const { data: anonymised, error: anonError } = await supabase
    .from("calls")
    .update({ transcript: [], summary: "", caller_name: "Unknown", caller_number: "", recording_url: null })
    .lt("started_at", cutoff)
    .or("caller_number.neq.,summary.neq.,caller_name.neq.Unknown")
    .select("id");
  if (anonError) result.errors.push(`calls anonimleştirilemedi: ${anonError.message}`);
  else result.callsAnonymised = anonymised?.length ?? 0;

  // 3. CRM log rows and callback leads.
  const { data: crm, error: crmError } = await supabase
    .from("crm_records")
    .delete()
    .lt("started_at", cutoff)
    .select("id");
  if (crmError) result.errors.push(`crm_records silinemedi: ${crmError.message}`);
  else result.crmRecordsDeleted = crm?.length ?? 0;

  const { data: leads, error: leadsError } = await supabase
    .from("leads")
    .delete()
    .lt("created_at", cutoff)
    .select("id");
  if (leadsError) result.errors.push(`leads silinemedi: ${leadsError.message}`);
  else result.leadsDeleted = leads?.length ?? 0;

  if (result.errors.length) result.status = "partial";
  return result;
}

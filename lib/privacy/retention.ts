import { getSupabaseServer } from "@/lib/supabase/server";
import { deleteCall, isVapiConfigured } from "@/lib/vapi/client";
import { DEMO_CALL_DAYS } from "@/lib/demo/try-call-server";
import { retireExpiredTrials } from "@/lib/demo/trials-server";

/**
 * Retention policy, run nightly by app/api/cron/retention. The less patient
 * data is kept, the less a breach exposes — and these periods are what the
 * privacy page and the data-processing agreement promise.
 *
 * - Calls are not recorded (no audio, see buildAssistant's artifactPlan).
 *   After VAPI_CALL_DAYS the call is deleted on Vapi too, so Vapi's copy of
 *   the transcript and logs goes; ours stays until CALL_DATA_DAYS.
 * - After CALL_DATA_DAYS the call row keeps only what the reports count
 *   (date, duration, outcome, sentiment): transcript, summary, name and
 *   number are wiped. CRM records and callback leads are deleted.
 *
 * - After USAGE_DAYS panel usage rows (usage_events) are deleted.
 * - After DEMO_CALL_DAYS the landing-page demo call log (hashed IPs).
 * - After FORM_DATA_DAYS demo requests and panel feedback (with its
 *   attachment in the private bucket) are deleted too.
 *
 * Appointments are left alone: the clinic's calendar needs them.
 */

// Vapi's plan only serves the last 14 days of calls; past that it refuses the
// delete ("exceeds your retention window"), so this must stay under 14. The
// cron runs daily, so 13 days means every call is deleted there inside it.
export const VAPI_CALL_DAYS = 13;
/** Transcripts, summaries, caller name and number — about six months. */
export const CALL_DATA_DAYS = 183;
/** Demo requests, web trials and panel feedback. */
export const FORM_DATA_DAYS = 365;
export const USAGE_DAYS = 180;

/** Vapi deletions per run — each is one HTTP call; the rest wait for tomorrow. */
const VAPI_BATCH = 50;

export interface RetentionResult {
  status: "ok" | "partial" | "skipped";
  vapiCallsDeleted: number;
  callsAnonymised: number;
  crmRecordsDeleted: number;
  leadsDeleted: number;
  usageRowsDeleted: number;
  demoRequestsDeleted: number;
  demoCallsDeleted: number;
  trialsRetired: number;
  trialsDeleted: number;
  feedbackDeleted: number;
  errors: string[];
}

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

export async function runRetention(): Promise<RetentionResult> {
  const result: RetentionResult = {
    status: "ok",
    vapiCallsDeleted: 0,
    callsAnonymised: 0,
    crmRecordsDeleted: 0,
    leadsDeleted: 0,
    usageRowsDeleted: 0,
    demoRequestsDeleted: 0,
    demoCallsDeleted: 0,
    trialsRetired: 0,
    trialsDeleted: 0,
    feedbackDeleted: 0,
    errors: [],
  };
  const supabase = getSupabaseServer();
  if (!supabase) return { ...result, status: "skipped" };

  // 1. Vapi's copy: delete the call there, then mark the row so it isn't retried.
  if (isVapiConfigured()) {
    const { data: due, error } = await supabase
      .from("calls")
      .select("id")
      .lt("started_at", daysAgo(VAPI_CALL_DAYS))
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
      else result.vapiCallsDeleted++;
    }
  }

  // 2. Transcripts and caller details on call rows.
  const cutoff = daysAgo(CALL_DATA_DAYS);
  const formCutoff = daysAgo(FORM_DATA_DAYS);
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

  // 4. Panel usage rows (the /admin Özet tab only looks back 7 days).
  const { data: usage, error: usageError } = await supabase
    .from("usage_events")
    .delete()
    .lt("day", daysAgo(USAGE_DAYS).slice(0, 10))
    .select("user_id");
  if (usageError) result.errors.push(`usage_events silinemedi: ${usageError.message}`);
  else result.usageRowsDeleted = usage?.length ?? 0;

  // 5. Demo requests from the marketing site.
  const { data: demos, error: demoError } = await supabase
    .from("demo_requests")
    .delete()
    .lt("created_at", formCutoff)
    .select("id");
  if (demoError) result.errors.push(`demo_requests silinemedi: ${demoError.message}`);
  else result.demoRequestsDeleted = demos?.length ?? 0;

  // 5b. Landing-page demo call starts (hashed IPs, only for the daily cap).
  const { data: demoCalls, error: demoCallError } = await supabase
    .from("demo_call_starts")
    .delete()
    .lt("created_at", daysAgo(DEMO_CALL_DAYS))
    .select("id");
  if (demoCallError) result.errors.push(`demo_call_starts silinemedi: ${demoCallError.message}`);
  else result.demoCallsDeleted = demoCalls?.length ?? 0;

  // 5c. Clinic web trials: an expired one's Vapi assistant goes the next night;
  // the row (clinic name and the facts typed in for it) after FORM_DATA_DAYS.
  const retired = await retireExpiredTrials();
  result.trialsRetired = retired.retired;
  result.errors.push(...retired.errors);
  const { data: oldTrials, error: trialError } = await supabase
    .from("demo_trials")
    .delete()
    .lt("created_at", formCutoff)
    .is("vapi_assistant_id", null)
    .select("id");
  if (trialError) result.errors.push(`demo_trials silinemedi: ${trialError.message}`);
  else result.trialsDeleted = oldTrials?.length ?? 0;

  // 6. Panel feedback: the attachment first (private bucket), then the row.
  const { data: oldFeedback, error: fbReadError } = await supabase
    .from("feedback")
    .select("id, attachment_path")
    .lt("created_at", formCutoff)
    .limit(500);
  if (fbReadError) result.errors.push(`feedback okunamadı: ${fbReadError.message}`);
  else if (oldFeedback?.length) {
    const paths = oldFeedback.map((r) => r.attachment_path as string | null).filter((x): x is string => !!x);
    if (paths.length) {
      const { error: rmError } = await supabase.storage.from("feedback-attachments").remove(paths);
      if (rmError) result.errors.push(`feedback ekleri silinemedi: ${rmError.message}`);
    }
    const { data: fb, error: fbError } = await supabase
      .from("feedback")
      .delete()
      .in("id", oldFeedback.map((r) => r.id as string))
      .select("id");
    if (fbError) result.errors.push(`feedback silinemedi: ${fbError.message}`);
    else result.feedbackDeleted = fb?.length ?? 0;
  }

  if (result.errors.length) result.status = "partial";
  return result;
}

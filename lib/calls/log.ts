import { getSupabaseServer } from "@/lib/supabase/server";
import type { ActionResult, CallActionPayload } from "@/lib/actions/types";

/**
 * Inserts a finished call into `calls` (supabase/schema.sql) — the table
 * behind /calls and the dashboard's recent-calls list. Runs independently of
 * which post-call actions the agent has on; `results` just becomes the
 * call's "actions taken" notes. Best-effort: a failure here never blocks the
 * webhook's response, and does nothing when Supabase isn't configured.
 */
export async function logCall(payload: CallActionPayload, results: ActionResult[]): Promise<void> {
  const supabase = getSupabaseServer();
  if (!supabase) return;

  // Upsert, not insert: Vapi redelivers a report it didn't get a 200 for, and
  // a duplicate-key error here used to bury the retry silently.
  const { error } = await supabase.from("calls").upsert(
    {
      id: payload.callId,
      agent_id: payload.agentId,
      caller_name: payload.caller,
      caller_number: payload.number,
      started_at: payload.startedAt,
      duration_sec: payload.durationSec,
      outcome: payload.outcome,
      summary: payload.summary,
      transcript: payload.transcript,
      actions: results.map((r) => r.note),
      sentiment: payload.sentiment,
      recording_url: payload.recordingUrl ?? null,
    },
    { onConflict: "id" },
  );

  if (error) console.error("[calls] failed to log call:", error.message);
}

import { getSupabaseServer } from "@/lib/supabase/server";

const OVERLAP_MS = 5 * 60 * 1000;
const FIRST_RUN_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;
const BATCH_LIMIT = 500;

export interface CrmSyncResult {
  status: "ok" | "skipped" | "error";
  synced: number;
  since: string | null;
  note?: string;
}

/**
 * Backfill safety net for the internal CRM: copies `calls` rows into
 * `crm_records` for any call the post-call action pipeline missed (webhook
 * failure, agent without the CRM action on at the time, records written late).
 *
 * The cursor is the newest already-synced call's `started_at` minus a 5-minute
 * overlap; upserting on `call_id` makes replaying that overlap harmless.
 */
export async function syncCallsToCrm(): Promise<CrmSyncResult> {
  const supabase = getSupabaseServer();
  if (!supabase) {
    return { status: "skipped", synced: 0, since: null, note: "Supabase bağlı değil — demo mod." };
  }

  const { data: latest, error: cursorError } = await supabase
    .from("crm_records")
    .select("started_at")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cursorError) {
    return { status: "error", synced: 0, since: null, note: cursorError.message };
  }

  const now = Date.now();
  const since = new Date(
    latest?.started_at ? new Date(latest.started_at).getTime() - OVERLAP_MS : now - FIRST_RUN_LOOKBACK_MS,
  ).toISOString();

  const { data: calls, error: callsError } = await supabase
    .from("calls")
    .select("id,agent_id,caller_name,caller_number,started_at,duration_sec,outcome,summary,transcript,actions,created_at,agents(name)")
    .gt("started_at", since)
    .order("started_at", { ascending: true })
    .limit(BATCH_LIMIT);

  if (callsError) {
    return { status: "error", synced: 0, since, note: callsError.message };
  }
  if (!calls?.length) {
    return { status: "ok", synced: 0, since };
  }

  const rows = calls.map((call) => ({
    call_id: String(call.id),
    agent_id: call.agent_id ?? "unknown",
    agent_name: agentNameOf(call.agents) ?? "Bilinmeyen Asistan",
    caller_name: call.caller_name || "Unknown",
    caller_number: call.caller_number || "",
    started_at: call.started_at || call.created_at,
    duration_sec: Number(call.duration_sec) || 0,
    outcome: call.outcome || "unknown",
    summary: call.summary || "",
    transcript: Array.isArray(call.transcript) ? call.transcript : [],
    // The one field the real-time write path can't produce — this is why the
    // sync still earns its keep even when no calls were actually missed.
    actions: Array.isArray(call.actions) ? call.actions : [],
  }));

  const { error: upsertError } = await supabase
    .from("crm_records")
    .upsert(rows, { onConflict: "call_id" });

  if (upsertError) {
    return { status: "error", synced: 0, since, note: upsertError.message };
  }

  return { status: "ok", synced: rows.length, since };
}

// PostgREST returns an embedded one-to-one relation as an object, but its
// generated types widen it to an array — normalise both shapes.
function agentNameOf(agents: unknown): string | null {
  const rel = Array.isArray(agents) ? agents[0] : agents;
  const name = (rel as { name?: string } | null)?.name;
  return name || null;
}

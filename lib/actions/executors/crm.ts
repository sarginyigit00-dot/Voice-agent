import type { ActionResult, CallActionPayload } from "@/lib/actions/types";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * Internal CRM: inserts the finished call into our own `crm_records` table
 * (supabase/schema.sql) — that's what powers the /crm page. Falls back to
 * "demo" when Supabase isn't configured, same as the other executors.
 *
 * If CRM_WEBHOOK_URL is also set, the record is additionally forwarded there
 * (Zapier/Make/n8n or a CRM's own incoming webhook) — that stays optional.
 *
 * Note the `actions` column is deliberately left empty here: runAgentActions
 * runs every executor in parallel and logCall happens after them (see
 * app/api/vapi/webhook/route.ts), so at this point no executor can see the
 * other action notes. The cron sync fills it in from the calls table within
 * five minutes (lib/crm/sync.ts).
 */
export async function runCrm(payload: CallActionPayload): Promise<ActionResult> {
  const supabase = getSupabaseServer();
  if (!supabase) {
    return { actionId: "crm", status: "demo", note: "Supabase bağlı değil — demo modda kaydedildi." };
  }

  const { error } = await supabase.from("crm_records").upsert(
    {
      call_id: payload.callId,
      agent_id: payload.agentId,
      agent_name: payload.agentName,
      caller_name: payload.caller,
      caller_number: payload.number,
      started_at: payload.startedAt,
      duration_sec: payload.durationSec,
      outcome: payload.outcome,
      summary: payload.summary,
      transcript: payload.transcript,
    },
    { onConflict: "call_id" },
  );

  if (error) {
    return { actionId: "crm", status: "error", note: `Kayıt başarısız: ${error.message}` };
  }

  await forwardToWebhook(payload);
  return { actionId: "crm", status: "ok", note: "CRM'e kaydedildi." };
}

async function forwardToWebhook(payload: CallActionPayload) {
  const url = process.env.CRM_WEBHOOK_URL;
  if (!url) return;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "randevox", event: "call.completed", call: payload }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
  } catch {
    // Best-effort — the internal record above is the source of truth.
  }
}

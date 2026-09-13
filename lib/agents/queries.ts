"use client";

import { getSupabaseBrowser } from "@/lib/supabase/client";
import { authedFetch } from "@/lib/supabase/authed-fetch";
import type { VapiSyncResult } from "@/lib/vapi/sync";
import type { Agent } from "@/lib/demo/data";
import type { ActionId } from "@/lib/actions/registry";
import type { L } from "@/lib/i18n/config";
import { normalizeWorkingHours, type WorkingHours } from "@/lib/agents/hours";

/** Shape of a row in the `agents` table (supabase/schema.sql). */
interface AgentRow {
  id: string;
  name: string;
  voice: string;
  purpose: L;
  greeting: L;
  active: boolean;
  calls_today: number;
  action_ids: ActionId[];
  system_prompt: string;
  working_hours: WorkingHours | Record<string, never>;
  vapi_assistant_id?: string | null;
}

function agentFromRow(r: AgentRow): Agent {
  return {
    id: r.id,
    name: r.name,
    voice: r.voice,
    purpose: r.purpose,
    greeting: r.greeting,
    active: r.active,
    callsToday: r.calls_today,
    actionIds: r.action_ids,
    systemPrompt: r.system_prompt ?? "",
    // Rows written before these columns existed carry `{}` — normalize fills
    // in the defaults so the booking path never sees a half-built schedule.
    workingHours: normalizeWorkingHours(r.working_hours),
    vapiAssistantId: r.vapi_assistant_id ?? null,
  };
}

/**
 * No vapi_assistant_id: only the server writes it (lib/vapi/sync.ts), and a
 * save from the browser must never overwrite or clear it.
 */
function toRow(a: Agent): Omit<AgentRow, "vapi_assistant_id"> {
  return {
    id: a.id,
    name: a.name,
    voice: a.voice,
    purpose: a.purpose,
    greeting: a.greeting,
    active: a.active,
    calls_today: a.callsToday,
    action_ids: a.actionIds,
    system_prompt: a.systemPrompt,
    working_hours: a.workingHours,
  };
}

/**
 * Reads every agent for the team. Returns null when Supabase isn't
 * configured or the request fails — callers fall back to demo data.
 */
export async function fetchAgents(): Promise<Agent[] | null> {
  const supabase = getSupabaseBrowser();
  if (!supabase) return null;

  const { data, error } = await supabase.from("agents").select("*").order("created_at", { ascending: true });
  if (error) {
    console.error("[agents] failed to list agents:", error.message);
    return null;
  }
  return (data as AgentRow[]).map(agentFromRow);
}

/**
 * Seeds a brand-new (empty) clinic with the starter agents, once, and returns
 * them as stored.
 *
 * Fresh ids every time: `agents.id` is unique across ALL clinics, so reusing
 * the demo ids ("ag1"…) would make every clinic after the first collide with
 * the first one's rows and fail to seed. `clinic_id` is left to the column
 * default — the signed-in user's clinic (supabase/schema.sql).
 */
export async function seedAgents(agents: Agent[]): Promise<Agent[]> {
  const seeded = agents.map((a) => ({ ...a, id: `ag-${crypto.randomUUID()}` }));
  const supabase = getSupabaseBrowser();
  if (!supabase) return seeded;
  const { error } = await supabase.from("agents").insert(seeded.map(toRow));
  if (error) console.error("[agents] failed to seed agents:", error.message);
  return seeded;
}

export async function insertAgent(agent: Agent): Promise<void> {
  const supabase = getSupabaseBrowser();
  if (!supabase) return;
  const { error } = await supabase.from("agents").insert(toRow(agent));
  if (error) console.error("[agents] failed to insert agent:", error.message);
}

/** True once the row is written — the Vapi sync only runs after that. */
export async function saveAgent(agent: Agent): Promise<boolean> {
  const supabase = getSupabaseBrowser();
  if (!supabase) return false;
  const { error } = await supabase.from("agents").update(toRow(agent)).eq("id", agent.id);
  if (error) console.error("[agents] failed to save agent:", error.message);
  return !error;
}

async function postSync(body: { agentId: string; action?: "delete" }): Promise<VapiSyncResult> {
  try {
    const res = await authedFetch("/api/agents/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await res.json()) as VapiSyncResult;
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

/** Pushes a saved agent onto its Vapi assistant (app/api/agents/sync). */
export function syncAgent(id: string): Promise<VapiSyncResult> {
  return postSync({ agentId: id });
}

/**
 * Deleted server-side rather than with the browser client: the agent's Vapi
 * assistant has to go too, and only the server holds the Vapi key.
 */
export async function removeAgent(id: string): Promise<void> {
  const res = await postSync({ agentId: id, action: "delete" });
  if (!res.ok) console.error("[agents] failed to delete agent:", res.message);
}

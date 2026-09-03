"use client";

import { getSupabaseBrowser } from "@/lib/supabase/client";
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
  };
}

function toRow(a: Agent): AgentRow {
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

/** Seeds a brand-new (empty) workspace with the starter agents, once. */
export async function seedAgents(agents: Agent[]): Promise<void> {
  const supabase = getSupabaseBrowser();
  if (!supabase) return;
  const { error } = await supabase.from("agents").insert(agents.map(toRow));
  if (error) console.error("[agents] failed to seed agents:", error.message);
}

export async function insertAgent(agent: Agent): Promise<void> {
  const supabase = getSupabaseBrowser();
  if (!supabase) return;
  const { error } = await supabase.from("agents").insert(toRow(agent));
  if (error) console.error("[agents] failed to insert agent:", error.message);
}

export async function saveAgent(agent: Agent): Promise<void> {
  const supabase = getSupabaseBrowser();
  if (!supabase) return;
  const { error } = await supabase.from("agents").update(toRow(agent)).eq("id", agent.id);
  if (error) console.error("[agents] failed to save agent:", error.message);
}

export async function deleteAgent(id: string): Promise<void> {
  const supabase = getSupabaseBrowser();
  if (!supabase) return;
  const { error } = await supabase.from("agents").delete().eq("id", id);
  if (error) console.error("[agents] failed to delete agent:", error.message);
}

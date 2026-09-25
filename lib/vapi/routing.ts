import { getSupabaseServer } from "@/lib/supabase/server";
import { isWithinHours, normalizeWorkingHours } from "@/lib/agents/hours";

/**
 * Who picks up an inbound call — answered to Vapi's `assistant-request`.
 *
 * A Vapi number can be bound to exactly one assistant, so "a separate agent
 * after hours" can't be configured on the number itself. Instead the number
 * is left without an assistant (admin → Telefon → "Numaraya bağla" puts it in
 * this mode), and on every call Vapi asks our webhook which assistant to use.
 *
 * The rule: inside the day agent's working hours (= the clinic's opening
 * hours) the day agent answers; outside them the after-hours agent does, if
 * one is set and live. Anything missing falls back to the day agent, so a
 * half-configured clinic still answers.
 *
 * Vapi drops the call if this doesn't answer within 7.5 s: two small reads,
 * nothing else.
 */

type Routed = { assistantId: string; agentId: string; afterHours: boolean } | { error: string };

interface RouteAgentRow {
  id: string;
  active: boolean;
  vapi_assistant_id: string | null;
  working_hours: unknown;
}

const UNAVAILABLE = "Şu anda aramanızı karşılayamıyoruz, lütfen daha sonra tekrar arayın.";

export async function routeInboundCall(phoneNumberId: string | undefined, now = new Date()): Promise<Routed> {
  const supabase = getSupabaseServer();
  if (!supabase || !phoneNumberId) return { error: UNAVAILABLE };

  const { data: clinic, error } = await supabase
    .from("clinics")
    .select("id, day_agent_id, after_hours_agent_id")
    .eq("vapi_phone_number_id", phoneNumberId)
    .maybeSingle();
  if (error || !clinic?.day_agent_id) {
    console.error(`[routing] no day agent for number ${phoneNumberId}:`, error?.message ?? "not configured");
    return { error: UNAVAILABLE };
  }

  const ids = [clinic.day_agent_id, clinic.after_hours_agent_id].filter(Boolean) as string[];
  const { data: rows, error: agentsError } = await supabase
    .from("agents")
    .select("id, active, vapi_assistant_id, working_hours")
    .eq("clinic_id", clinic.id)
    .in("id", ids);
  if (agentsError || !rows) {
    console.error("[routing] agent lookup failed:", agentsError?.message);
    return { error: UNAVAILABLE };
  }

  const byId = new Map((rows as RouteAgentRow[]).map((r) => [r.id, r]));
  const day = byId.get(clinic.day_agent_id);
  const night = clinic.after_hours_agent_id ? byId.get(clinic.after_hours_agent_id) : undefined;
  const live = (a: RouteAgentRow | undefined): a is RouteAgentRow & { vapi_assistant_id: string } =>
    Boolean(a?.active && a.vapi_assistant_id);

  const open = day ? isWithinHours(now, normalizeWorkingHours(day.working_hours)) : true;
  if (!open && live(night)) return { assistantId: night.vapi_assistant_id, agentId: night.id, afterHours: true };
  if (live(day)) return { assistantId: day.vapi_assistant_id, agentId: day.id, afterHours: false };
  // The day agent is paused: the night line, if there is one, covers the whole day.
  if (live(night)) return { assistantId: night.vapi_assistant_id, agentId: night.id, afterHours: true };
  return { error: UNAVAILABLE };
}

import { getSupabaseServer } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import { AGENTS, type Agent } from "@/lib/demo/data";
import { normalizeWorkingHours, type WorkingHours } from "@/lib/agents/hours";

/**
 * Multi-tenancy, server side.
 *
 * Every customer is a row in `clinics`; staff belong to one through
 * `clinic_members` (supabase/schema.sql). In the browser, RLS keeps each
 * clinic inside its own rows. Server code is different: it runs with the
 * service-role key, which bypasses RLS entirely — so every route and webhook
 * that touches clinic data must scope itself through the helpers here.
 * Nothing else stands between one clinic and another's patients.
 */

/** How patient messages (confirmation, reminders, cancel/reschedule) leave n8n. */
export type MessageChannel = "off" | "sms" | "whatsapp";

export const isMessageChannel = (v: unknown): v is MessageChannel => v === "off" || v === "sms" || v === "whatsapp";

export interface ClinicContext {
  id: string;
  name: string;
  status: "active" | "suspended";
  timeZone: string;
  /** Where the agent hands a caller who asks for a person. */
  transferNumber: string | null;
  /** Booking confirmations when the caller gave no email; the weekly report. */
  notifyEmail: string | null;
  /** Optional: this clinic's own CRM, sent every finished call. */
  crmWebhookUrl: string | null;
  /** The clinic's line in Vapi — its phone-number id, not the number itself. */
  vapiPhoneNumberId: string | null;
  /** Patient messages via n8n: Netgsm SMS, or WhatsApp once Meta approves the templates. */
  messageChannel: MessageChannel;
  /** Hızlı geri dönüş: the agent that phones new leads. Null = off. */
  callbackAgentId: string | null;
  /** The Vapi number outbound calls go out on, when it isn't the inbound one. */
  vapiOutboundPhoneNumberId: string | null;
  /**
   * Who answers the line. The day agent's working hours ARE the clinic's
   * opening hours; outside them the after-hours agent picks up, if one is set
   * (lib/vapi/routing.ts). Null after-hours = the day agent answers around the clock.
   */
  dayAgentId: string | null;
  afterHoursAgentId: string | null;
}

const CLINIC_COLUMNS =
  "id, name, status, time_zone, transfer_number, notify_email, crm_webhook_url, vapi_phone_number_id, message_channel, callback_agent_id, vapi_outbound_phone_number_id, day_agent_id, after_hours_agent_id";

interface ClinicRow {
  id: string;
  name: string;
  status: string;
  time_zone: string;
  transfer_number: string | null;
  notify_email: string | null;
  crm_webhook_url: string | null;
  vapi_phone_number_id: string | null;
  message_channel: string | null;
  callback_agent_id: string | null;
  vapi_outbound_phone_number_id: string | null;
  day_agent_id: string | null;
  after_hours_agent_id: string | null;
}

function clinicFromRow(r: ClinicRow): ClinicContext {
  return {
    id: r.id,
    name: r.name,
    status: r.status === "suspended" ? "suspended" : "active",
    timeZone: r.time_zone || "Europe/Istanbul",
    transferNumber: r.transfer_number,
    notifyEmail: r.notify_email,
    crmWebhookUrl: r.crm_webhook_url,
    vapiPhoneNumberId: r.vapi_phone_number_id,
    messageChannel: isMessageChannel(r.message_channel) ? r.message_channel : "off",
    callbackAgentId: r.callback_agent_id,
    vapiOutboundPhoneNumberId: r.vapi_outbound_phone_number_id,
    dayAgentId: r.day_agent_id,
    afterHoursAgentId: r.after_hours_agent_id,
  };
}

// PostgREST returns an embedded many-to-one relation as an object, but its
// generated types widen it to an array — normalise both shapes.
function embedded<T>(rel: T | T[] | null | undefined): T | null {
  return (Array.isArray(rel) ? rel[0] : rel) ?? null;
}

/* ───────────────────────── Vapi call → agent → clinic ───────────────────────── */

interface AgentDbRow {
  id: string;
  name: string;
  voice: string;
  purpose: Agent["purpose"];
  greeting: Agent["greeting"];
  active: boolean;
  calls_today: number;
  action_ids: Agent["actionIds"];
  system_prompt: string | null;
  working_hours: unknown;
  vapi_assistant_id: string | null;
  clinics?: ClinicRow | ClinicRow[] | null;
}

function agentFromRow(r: AgentDbRow): Agent {
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
    workingHours: normalizeWorkingHours(r.working_hours),
    vapiAssistantId: r.vapi_assistant_id,
  };
}

export interface CallOwner {
  agent: Agent;
  /** Null only in demo mode (no Supabase), where nothing is persisted. */
  clinic: ClinicContext | null;
}

/**
 * Who owns a Vapi call: the agent it was placed on, and that agent's clinic.
 *
 * Matched on `agents.vapi_assistant_id` only — written by lib/vapi/sync.ts
 * when the agent is pushed to Vapi. (It used to fall back to our own agent id
 * for hand-wired assistants; but agent ids are chosen in the browser, so a
 * clinic could have named an agent after someone else's assistant.) Null when
 * nothing matches, and callers must then persist NOTHING. The old behaviour (fall back to the first agent) was harmless with
 * one clinic and a data leak with two: a stranger's call, transcript and
 * phone number written into whichever clinic happened to sort first.
 */
export async function resolveCallOwner(assistantId: string | undefined): Promise<CallOwner | null> {
  const supabase = getSupabaseServer();
  if (!supabase) {
    // Demo mode: nothing is written anywhere, so the sample agents are a safe stand-in.
    return { agent: AGENTS.find((a) => a.id === assistantId) ?? AGENTS[0], clinic: null };
  }
  if (!assistantId) return null;

  const { data, error } = await supabase
    .from("agents")
    // Named FK: clinics.callback_agent_id also links the two tables, and an
    // ambiguous embed fails every lookup (PGRST201).
    .select(`*, clinics!agents_clinic_id_fkey(${CLINIC_COLUMNS})`)
    .eq("vapi_assistant_id", assistantId)
    .maybeSingle();

  if (error) {
    console.error("[clinics] agent lookup failed:", error.message);
    return null;
  }
  if (!data) return null;
  const row = data as AgentDbRow;
  const clinic = embedded(row.clinics);
  // clinic_id is NOT NULL, so this only happens mid-migration — and a
  // call we can't place in a clinic is a call we don't write.
  if (!clinic) return null;
  return { agent: agentFromRow(row), clinic: clinicFromRow(clinic) };
}

/** One agent, only if it belongs to this clinic — plus the Vapi assistant it's linked to. */
export async function agentInClinic(
  agentId: string,
  clinicId: string,
): Promise<{ agent: Agent; vapiAssistantId: string | null } | null> {
  const supabase = getSupabaseServer();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .eq("id", agentId)
    .eq("clinic_id", clinicId)
    .maybeSingle();
  if (error) console.error("[clinics] agent lookup failed:", error.message);
  if (!data) return null;
  const row = data as AgentDbRow;
  return { agent: agentFromRow(row), vapiAssistantId: row.vapi_assistant_id };
}

/** For operator-side code (/admin), which acts on a clinic by id rather than as its member. */
export async function clinicById(clinicId: string): Promise<ClinicContext | null> {
  const supabase = getSupabaseServer();
  if (!supabase) return null;

  const { data, error } = await supabase.from("clinics").select(CLINIC_COLUMNS).eq("id", clinicId).maybeSingle();
  if (error) console.error("[clinics] clinic lookup failed:", error.message);
  return data ? clinicFromRow(data as ClinicRow) : null;
}

/* ───────────────────────── signed-in staff → clinic ───────────────────────── */

/**
 * The clinic a user works in — their oldest membership. Null when they have
 * none (an account the operator hasn't attached to a clinic yet).
 */
export async function clinicForUser(userId: string): Promise<ClinicContext | null> {
  const supabase = getSupabaseServer();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("clinic_members")
    .select(`clinics(${CLINIC_COLUMNS})`)
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[clinics] membership lookup failed:", error.message);
    return null;
  }
  const clinic = embedded((data as { clinics: ClinicRow | ClinicRow[] | null } | null)?.clinics);
  return clinic ? clinicFromRow(clinic) : null;
}

export type MemberCheck =
  | { ok: true; user: { id: string; email: string | null }; clinic: ClinicContext }
  | { ok: false; status: 401 | 403; error: string };

/**
 * requireUser, plus the clinic the user belongs to. What every panel route
 * holding the service-role key must call instead of requireUser alone — a
 * verified session proves who someone is, not which clinic's rows they may
 * touch.
 */
export async function requireMember(req: Request): Promise<MemberCheck> {
  const user = await requireUser(req);
  if (!user) return { ok: false, status: 401, error: "Oturum gerekli." };

  const clinic = await clinicForUser(user.id);
  if (!clinic) return { ok: false, status: 403, error: "Hesabınız henüz bir kliniğe bağlı değil." };

  return { ok: true, user, clinic };
}

/* ───────────────────────── opening hours ───────────────────────── */

/**
 * The clinic's opening hours: the day agent's working hours. The after-hours
 * agent answers when these are closed, and still books INTO them — its own
 * hours only say when it answers, never when patients can come in.
 * Null when no day agent is set.
 */
export async function clinicOpeningHours(clinic: ClinicContext): Promise<WorkingHours | null> {
  if (!clinic.dayAgentId) return null;
  const supabase = getSupabaseServer();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("agents")
    .select("working_hours")
    .eq("id", clinic.dayAgentId)
    .eq("clinic_id", clinic.id)
    .maybeSingle();
  if (error || !data) return null;
  return normalizeWorkingHours(data.working_hours);
}

/** Whether this agent is the clinic's after-hours line (and so books into the day agent's hours). */
export function isAfterHoursAgent(clinic: ClinicContext | null, agentId: string): boolean {
  return Boolean(clinic?.afterHoursAgentId && clinic.afterHoursAgentId === agentId && clinic.dayAgentId !== agentId);
}

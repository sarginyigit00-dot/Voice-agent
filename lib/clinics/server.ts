import { getSupabaseServer } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import { AGENTS, type Agent } from "@/lib/demo/data";
import { normalizeWorkingHours } from "@/lib/agents/hours";

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
}

const CLINIC_COLUMNS = "id, name, status, time_zone, transfer_number, notify_email, crm_webhook_url";

interface ClinicRow {
  id: string;
  name: string;
  status: string;
  time_zone: string;
  transfer_number: string | null;
  notify_email: string | null;
  crm_webhook_url: string | null;
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
  clinics: ClinicRow | ClinicRow[] | null;
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
 * Matched on `agents.vapi_assistant_id` — written when an agent is pushed to
 * Vapi — and, for agents wired up by hand before that column existed, on our
 * own agent id. Null when neither matches, and callers must then persist
 * NOTHING. The old behaviour (fall back to the first agent) was harmless with
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

  // Two plain equality lookups rather than one `.or()` filter string, so the
  // id from the webhook body is never spliced into PostgREST syntax.
  for (const column of ["vapi_assistant_id", "id"] as const) {
    const { data, error } = await supabase
      .from("agents")
      .select(`*, clinics(${CLINIC_COLUMNS})`)
      .eq(column, assistantId)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(`[clinics] agent lookup by ${column} failed:`, error.message);
      return null;
    }
    if (data) {
      const row = data as AgentDbRow;
      const clinic = embedded(row.clinics);
      // clinic_id is NOT NULL, so this only happens mid-migration — and a
      // call we can't place in a clinic is a call we don't write.
      if (!clinic) return null;
      return { agent: agentFromRow(row), clinic: clinicFromRow(clinic) };
    }
  }
  return null;
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

import { randomBytes } from "node:crypto";
import { getSupabaseServer } from "@/lib/supabase/server";
import { agentInClinic, clinicById } from "@/lib/clinics/server";
import { isWithinHours } from "@/lib/agents/hours";
import { isVapiConfigured, startCallbackCall, toE164 } from "@/lib/vapi/client";
import type { Outcome } from "@/lib/demo/data";

/**
 * Hızlı geri dönüş: a patient fills in a clinic's lead form (its website, or a
 * Meta lead ad relayed by n8n), and the clinic's callback agent phones them
 * within a minute.
 *
 * - app/api/leads takes the form (`?key=` names the clinic, never an id) and
 *   calls `processLead` right after answering.
 * - Outside the agent's working hours a lead waits; n8n polls
 *   app/api/automation/lead-callbacks every few minutes and `processDueLeads`
 *   phones it once the clinic opens. Failed calls retry the same way.
 * - The call itself is an ordinary call on the agent's own assistant, so the
 *   webhook logs it to /calls like any other; `markLeadCallEnded` only notes
 *   the outcome back on the lead.
 */

export type LeadSource = "web" | "meta" | "manual";
export type LeadStatus = "new" | "waiting" | "calling" | "called" | "failed" | "skipped";
export const LEAD_STATUSES: LeadStatus[] = ["new", "waiting", "calling", "called", "failed", "skipped"];

const MAX_ATTEMPTS = 3;
const HOUR = 60 * 60 * 1000;
/** The same number again within a day is the same person resubmitting — one call is enough. */
const DEDUPE_MS = 24 * HOUR;
/** A lead nobody could reach in three days is cold; calling it now would surprise more than help. */
const EXPIRE_MS = 72 * HOUR;

export const isLeadSource = (v: unknown): v is LeadSource => v === "web" || v === "meta" || v === "manual";

/** Unguessable, URL-safe. It sits in a public web form, so it only names a clinic — it unlocks nothing else. */
export function newLeadFormKey(): string {
  return randomBytes(18).toString("base64url");
}

export interface LeadInput {
  name: string;
  phone: string;
  note: string | null;
  source: LeadSource;
  consent: boolean;
}

export type IntakeResult =
  | { ok: true; leadId: string | null; duplicate: boolean }
  | { ok: false; status: 400 | 404 | 500 | 503; error: string };

export async function intakeLead(key: string, input: LeadInput): Promise<IntakeResult> {
  const supabase = getSupabaseServer();
  if (!supabase) return { ok: false, status: 503, error: "not_configured" };
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(key)) return { ok: false, status: 404, error: "unknown_form" };

  const { data: clinic, error: clinicError } = await supabase
    .from("clinics")
    .select("id")
    .eq("lead_form_key", key)
    .maybeSingle();
  if (clinicError) {
    console.error("[leads] clinic lookup failed:", clinicError.message);
    return { ok: false, status: 500, error: "failed" };
  }
  if (!clinic) return { ok: false, status: 404, error: "unknown_form" };

  // KVKK / İYS: no recorded consent, no call.
  if (!input.consent) return { ok: false, status: 400, error: "consent" };
  const phone = toE164(input.phone);
  if (!phone) return { ok: false, status: 400, error: "phone" };

  const { data: recent } = await supabase
    .from("leads")
    .select("id")
    .eq("clinic_id", clinic.id)
    .eq("phone", phone)
    .gte("created_at", new Date(Date.now() - DEDUPE_MS).toISOString())
    .limit(1);
  if (recent?.length) return { ok: true, leadId: null, duplicate: true };

  const { data: lead, error } = await supabase
    .from("leads")
    .insert({
      clinic_id: clinic.id,
      name: input.name,
      phone,
      source: input.source,
      note: input.note,
      consent_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) {
    console.error("[leads] insert failed:", error.message);
    return { ok: false, status: 500, error: "failed" };
  }
  return { ok: true, leadId: lead.id, duplicate: false };
}

interface LeadRow {
  id: string;
  clinic_id: string;
  name: string;
  phone: string;
  source: string;
  note: string | null;
  status: LeadStatus;
  attempts: number;
  created_at: string;
}

/**
 * Phones one lead if it can be phoned now. Safe to call twice at once: the
 * lead is claimed with a conditional update before Vapi is asked for a call.
 */
export async function processLead(leadId: string): Promise<LeadStatus | null> {
  const supabase = getSupabaseServer();
  if (!supabase) return null;

  const { data } = await supabase.from("leads").select("*").eq("id", leadId).maybeSingle();
  const lead = data as LeadRow | null;
  if (!lead || (lead.status !== "new" && lead.status !== "waiting")) return lead?.status ?? null;

  const set = async (patch: Record<string, unknown>) => {
    const { error } = await supabase.from("leads").update(patch).eq("id", lead.id);
    if (error) console.error("[leads] update failed:", error.message);
  };
  const skip = async (reason: string): Promise<LeadStatus> => {
    await set({ status: "skipped", error: reason });
    return "skipped";
  };

  if (Date.now() - new Date(lead.created_at).getTime() > EXPIRE_MS) return skip("3 gün içinde aranamadı.");

  const clinic = await clinicById(lead.clinic_id);
  if (!clinic) return skip("Klinik bulunamadı.");
  if (clinic.status === "suspended") return skip("Klinik askıda.");
  if (!clinic.callbackAgentId) return skip("Klinikte hızlı geri dönüş kapalı.");
  const phoneNumberId = clinic.vapiOutboundPhoneNumberId ?? clinic.vapiPhoneNumberId;
  if (!phoneNumberId) return skip("Klinikte arama yapılacak Vapi numarası yok.");
  if (!isVapiConfigured()) return skip("Vapi bağlı değil.");

  const found = await agentInClinic(clinic.callbackAgentId, clinic.id);
  if (!found?.vapiAssistantId) return skip("Geri arama ajanı Vapi'de kurulu değil.");
  if (!found.agent.active) return skip("Geri arama ajanı duraklatılmış.");

  if (!isWithinHours(new Date(), found.agent.workingHours)) {
    if (lead.status !== "waiting") await set({ status: "waiting", error: "Mesai dışı; klinik açılınca aranacak." });
    return "waiting";
  }

  const attempts = lead.attempts + 1;
  const { data: claimed } = await supabase
    .from("leads")
    .update({ status: "calling", attempts })
    .eq("id", lead.id)
    .eq("status", lead.status)
    .select("id");
  if (!claimed?.length) return null; // someone else is already on it

  const res = await startCallbackCall({
    assistantId: found.vapiAssistantId,
    phoneNumberId,
    number: lead.phone,
    name: lead.name,
    note: lead.note,
    source: isLeadSource(lead.source) ? lead.source : "web",
    clinic,
  });

  if (res.ok) {
    await set({ status: "called", vapi_call_id: res.data.id, called_at: new Date().toISOString(), error: null });
    return "called";
  }
  const status: LeadStatus = attempts >= MAX_ATTEMPTS ? "failed" : "waiting";
  await set({ status, error: `Vapi: ${res.error}` });
  return status;
}

/** n8n's poll: everything still owed a call, oldest first. */
export async function processDueLeads(): Promise<Record<string, number>> {
  const supabase = getSupabaseServer();
  if (!supabase) return {};

  const { data, error } = await supabase
    .from("leads")
    .select("id")
    .in("status", ["new", "waiting"])
    // Fresh ones are still being handled by the intake request itself.
    .lte("created_at", new Date(Date.now() - 2 * 60 * 1000).toISOString())
    .order("created_at")
    .limit(25);
  if (error) {
    console.error("[leads] due lookup failed:", error.message);
    return {};
  }

  const counts: Record<string, number> = {};
  for (const { id } of data ?? []) {
    const status = (await processLead(id)) ?? "untouched";
    counts[status] = (counts[status] ?? 0) + 1;
  }
  return counts;
}

/** From the webhook: how the callback went. A no-op for every call that wasn't one. */
export async function markLeadCallEnded(callId: string, outcome: Outcome | string): Promise<void> {
  const supabase = getSupabaseServer();
  if (!supabase || !callId || callId === "unknown") return;
  const { error } = await supabase.from("leads").update({ result: outcome }).eq("vapi_call_id", callId);
  if (error) console.error("[leads] result update failed:", error.message);
}

import { randomBytes } from "node:crypto";
import { getSupabaseServer } from "@/lib/supabase/server";
import { clinicById } from "@/lib/clinics/server";
import { toE164 } from "@/lib/vapi/client";
import { sendLeadNotice } from "@/lib/notify/email";
import type { Outcome } from "@/lib/demo/data";

/**
 * Geri arama formu: a patient fills in a clinic's lead form (its website, or a
 * Meta lead ad relayed by whatever the clinic uses), and the clinic gets an
 * email to call them back — the clinic calls, by hand.
 *
 * No agent phones anyone. That used to happen (a "callback agent" dialled the
 * lead within a minute); it was switched off on 01.11.2026 because an AI
 * placing outbound calls is a KVKK risk the product doesn't take.
 * `clinics.callback_agent_id` and `leads.vapi_call_id` stay in the schema but
 * nothing writes them any more.
 *
 * - app/api/leads takes the form (`?key=` names the clinic, never an id) and
 *   calls `notifyClinicOfLead` right after answering.
 * - The lead stays `new`; its `error` column notes whether the email went out.
 */

export type LeadSource = "web" | "meta" | "manual";
export type LeadStatus = "new" | "waiting" | "calling" | "called" | "failed" | "skipped";
export const LEAD_STATUSES: LeadStatus[] = ["new", "waiting", "calling", "called", "failed", "skipped"];

const HOUR = 60 * 60 * 1000;
/** The same number again within a day is the same person resubmitting — one email is enough. */
const DEDUPE_MS = 24 * HOUR;

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
  /** The checkbox wording the person ticked, as the form sent it. */
  consentText: string | null;
  /** Where the form was sent from; null when a server relays it (Meta). */
  consentIp: string | null;
}

export type IntakeResult =
  | { ok: true; leadId: string | null; duplicate: boolean }
  | { ok: false; status: 400 | 404 | 429 | 500 | 503; error: string };

/** A leaked form key must not flood a clinic's inbox: at most this many new leads per clinic per day. */
const MAX_LEADS_PER_CLINIC_PER_DAY = 100;

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

  const { count: dayCount } = await supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinic.id)
    .gte("created_at", new Date(Date.now() - DEDUPE_MS).toISOString());
  if ((dayCount ?? 0) >= MAX_LEADS_PER_CLINIC_PER_DAY) {
    console.warn("[leads] daily cap reached for clinic", clinic.id);
    return { ok: false, status: 429, error: "rate_limited" };
  }

  const { data: lead, error } = await supabase
    .from("leads")
    .insert({
      clinic_id: clinic.id,
      name: input.name,
      phone,
      source: input.source,
      note: input.note,
      consent_at: new Date().toISOString(),
      consent_text: input.consentText,
      consent_ip: input.consentIp,
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
  created_at: string;
}

/**
 * Emails the clinic about one new lead so someone there calls back. Best
 * effort: the lead is already stored and visible in /admin either way; the
 * outcome is noted on the lead's `error` column.
 */
export async function notifyClinicOfLead(leadId: string): Promise<boolean> {
  const supabase = getSupabaseServer();
  if (!supabase) return false;

  const { data } = await supabase.from("leads").select("*").eq("id", leadId).maybeSingle();
  const lead = data as LeadRow | null;
  if (!lead) return false;

  const clinic = await clinicById(lead.clinic_id);
  let note: string;
  let sent = false;
  if (!clinic) note = "Klinik bulunamadı.";
  else if (clinic.status === "suspended") note = "Klinik askıda; bildirim gönderilmedi.";
  else if (!clinic.notifyEmail) note = "Klinikte bildirim e-postası yok; talep sadece panelde.";
  else {
    sent = await sendLeadNotice(clinic, {
      name: lead.name,
      phone: lead.phone,
      source: isLeadSource(lead.source) ? lead.source : "web",
      note: lead.note,
      createdAt: lead.created_at,
    });
    note = sent ? "Kliniğe e-postayla bildirildi; arama klinikte." : "E-posta gönderilemedi.";
  }

  const { error } = await supabase.from("leads").update({ error: note }).eq("id", lead.id);
  if (error) console.error("[leads] update failed:", error.message);
  return sent;
}

/**
 * The automation app's old 5-minute poll. Nothing is owed a call any more
 * (agents don't dial out), so this does nothing; kept so a still-deployed
 * automation app gets a clean answer instead of a 404.
 */
export async function processDueLeads(): Promise<Record<string, number>> {
  return {};
}

/** From the webhook: how the callback went. A no-op for every call that wasn't one. */
export async function markLeadCallEnded(callId: string, outcome: Outcome | string): Promise<void> {
  const supabase = getSupabaseServer();
  if (!supabase || !callId || callId === "unknown") return;
  const { error } = await supabase.from("leads").update({ result: outcome }).eq("vapi_call_id", callId);
  if (error) console.error("[leads] result update failed:", error.message);
}

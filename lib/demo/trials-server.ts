import { getSupabaseServer } from "@/lib/supabase/server";
import type { ClinicKnowledge } from "@/lib/clinics/knowledge-shape";
import { deleteAssistant } from "@/lib/vapi/client";
import { upsertDemoAssistant } from "@/lib/demo/demo-assistant";
import {
  newTrialCode,
  TRIAL_COUNTED_MIN_SECONDS,
  TRIAL_DAYS,
  TRIAL_MAX_CALLS,
  trialStatus,
  type TrialStatus,
} from "@/lib/demo/trials";

/** Storage for clinic web trials (schema: demo_trials, demo_trial_calls). Service role only. */

export interface Trial {
  id: string;
  code: string;
  clinicName: string;
  demoRequestId: string | null;
  vapiAssistantId: string | null;
  maxCalls: number;
  expiresAt: string;
  createdAt: string;
  source: "admin" | "self";
  email: string | null;
}

export interface TrialWithUsage extends Trial {
  used: number;
  status: TrialStatus;
}

interface TrialRow {
  id: string;
  code: string;
  clinic_name: string;
  demo_request_id: string | null;
  vapi_assistant_id: string | null;
  max_calls: number;
  expires_at: string;
  created_at: string;
  source: string;
  email: string | null;
}

const COLUMNS = "id, code, clinic_name, demo_request_id, vapi_assistant_id, max_calls, expires_at, created_at, source, email";

const fromRow = (r: TrialRow): Trial => ({
  id: r.id,
  code: r.code,
  clinicName: r.clinic_name,
  demoRequestId: r.demo_request_id,
  vapiAssistantId: r.vapi_assistant_id,
  maxCalls: r.max_calls,
  expiresAt: r.expires_at,
  createdAt: r.created_at,
  source: r.source === "self" ? "self" : "admin",
  email: r.email,
});

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

/** Row first (its id names the assistant), then the assistant; a failed Vapi push removes the row again. */
export async function createTrial(input: {
  clinicName: string;
  knowledge: ClinicKnowledge;
  demoRequestId: string | null;
  /** Self-serve only: where the link was sent, and the creator's hashed IP. */
  self?: { email: string; ipHash: string };
}): Promise<Result<Trial>> {
  const supabase = getSupabaseServer();
  if (!supabase) return { ok: false, error: "Supabase bağlı değil." };

  const { data, error } = await supabase
    .from("demo_trials")
    .insert({
      code: newTrialCode(),
      clinic_name: input.clinicName,
      demo_request_id: input.demoRequestId,
      knowledge: input.knowledge,
      max_calls: TRIAL_MAX_CALLS,
      expires_at: new Date(Date.now() + TRIAL_DAYS * 86_400_000).toISOString(),
      ...(input.self ? { source: "self", email: input.self.email, ip_hash: input.self.ipHash } : {}),
    })
    .select(COLUMNS)
    .single();
  if (error?.code === "23505" && input.self) return { ok: false, error: "email_taken" };
  if (error || !data) return { ok: false, error: error?.message ?? "Kayıt oluşturulamadı." };
  const trial = fromRow(data as TrialRow);

  const assistant = await upsertDemoAssistant({
    clinicName: trial.clinicName,
    knowledge: input.knowledge,
    existingId: null,
    trialId: trial.id,
  });
  if (!assistant.ok) {
    await supabase.from("demo_trials").delete().eq("id", trial.id);
    return { ok: false, error: `Vapi: ${assistant.error}` };
  }

  const { error: linkError } = await supabase
    .from("demo_trials")
    .update({ vapi_assistant_id: assistant.data.id })
    .eq("id", trial.id);
  if (linkError) {
    await deleteAssistant(assistant.data.id);
    await supabase.from("demo_trials").delete().eq("id", trial.id);
    return { ok: false, error: linkError.message };
  }
  return { ok: true, data: { ...trial, vapiAssistantId: assistant.data.id } };
}

async function usedCounts(ids: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const supabase = getSupabaseServer();
  if (!supabase || !ids.length) return counts;
  // Every started call counts — the visitor sees the number go down as they call.
  const { data } = await supabase.from("demo_call_starts").select("trial_id").in("trial_id", ids);
  for (const r of (data ?? []) as { trial_id: string }[]) counts.set(r.trial_id, (counts.get(r.trial_id) ?? 0) + 1);
  return counts;
}

const withUsage = (t: Trial, used: number): TrialWithUsage => ({ ...t, used, status: trialStatus(t, used) });

export async function listTrials(): Promise<TrialWithUsage[]> {
  const supabase = getSupabaseServer();
  if (!supabase) return [];
  const { data, error } = await supabase.from("demo_trials").select(COLUMNS).order("created_at", { ascending: false }).limit(200);
  if (error) {
    console.error("[trials] list failed:", error.message);
    return [];
  }
  const trials = (data as TrialRow[]).map(fromRow);
  const counts = await usedCounts(trials.map((t) => t.id));
  return trials.map((t) => withUsage(t, counts.get(t.id) ?? 0));
}

export async function trialByCode(code: string): Promise<TrialWithUsage | null> {
  const supabase = getSupabaseServer();
  if (!supabase || !/^[a-z0-9]{6,20}$/.test(code)) return null;
  const { data } = await supabase.from("demo_trials").select(COLUMNS).eq("code", code).maybeSingle();
  if (!data) return null;
  const trial = fromRow(data as TrialRow);
  const counts = await usedCounts([trial.id]);
  return withUsage(trial, counts.get(trial.id) ?? 0);
}

/** Self-serve: the trial already opened with this address, if any (one per address). */
export async function trialByEmail(email: string): Promise<Trial | null> {
  const supabase = getSupabaseServer();
  if (!supabase) return null;
  const { data } = await supabase.from("demo_trials").select(COLUMNS).eq("email", email.toLowerCase()).maybeSingle();
  return data ? fromRow(data as TrialRow) : null;
}

/**
 * Self-serve guard rails, counted in the database so every server instance
 * agrees: how many self-serve trials opened today in total, and from this IP.
 * Null when it can't be checked — the caller then refuses (fails closed).
 */
export async function selfServeCounts(ipHash: string, now = new Date()): Promise<{ today: number; fromIp: number } | null> {
  const supabase = getSupabaseServer();
  if (!supabase) return null;
  const since = new Date(now.getTime() - 86_400_000).toISOString();
  const [all, ip] = await Promise.all([
    supabase.from("demo_trials").select("id", { count: "exact", head: true }).eq("source", "self").gte("created_at", since),
    supabase.from("demo_trials").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", since),
  ]);
  if (all.error || ip.error) {
    console.error("[trials] self-serve count failed:", all.error?.message ?? ip.error?.message);
    return null;
  }
  return { today: all.count ?? 0, fromIp: ip.count ?? 0 };
}

/** The webhook's lookup: is this assistant a clinic trial's? */
export async function trialIdForAssistant(assistantId: string | undefined): Promise<string | null> {
  const supabase = getSupabaseServer();
  if (!supabase || !assistantId) return null;
  const { data, error } = await supabase.from("demo_trials").select("id").eq("vapi_assistant_id", assistantId).maybeSingle();
  if (error) console.error("[trials] assistant lookup failed:", error.message);
  return (data as { id: string } | null)?.id ?? null;
}

/** Counts a finished call once (call_id is the key), and only if it really happened. */
export async function recordTrialCall(trialId: string, callId: string | undefined, durationSec: number): Promise<boolean> {
  const supabase = getSupabaseServer();
  if (!supabase || !callId || !(durationSec >= TRIAL_COUNTED_MIN_SECONDS)) return false;
  const { error } = await supabase
    .from("demo_trial_calls")
    .upsert({ call_id: callId, trial_id: trialId, duration_sec: Math.round(durationSec) }, { onConflict: "call_id", ignoreDuplicates: true });
  if (error) console.error("[trials] count failed:", error.message);
  return !error;
}

/** Ends a trial now: its assistant goes, then the row (and its call log, by cascade). */
export async function deleteTrial(id: string): Promise<Result<null>> {
  const supabase = getSupabaseServer();
  if (!supabase) return { ok: false, error: "Supabase bağlı değil." };
  const { data } = await supabase.from("demo_trials").select("vapi_assistant_id").eq("id", id).maybeSingle();
  const assistantId = (data as { vapi_assistant_id: string | null } | null)?.vapi_assistant_id;
  if (assistantId) {
    const res = await deleteAssistant(assistantId);
    if (!res.ok) return { ok: false, error: `Vapi: ${res.error}` };
  }
  const { error } = await supabase.from("demo_trials").delete().eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true, data: null };
}

/**
 * Nightly (lib/privacy/retention.ts): an expired trial's assistant is
 * deleted on Vapi and unlinked; the row stays so /admin still shows how it
 * went, and goes with the rest of the demo data after a year.
 */
export async function retireExpiredTrials(): Promise<{ retired: number; errors: string[] }> {
  const supabase = getSupabaseServer();
  const out = { retired: 0, errors: [] as string[] };
  if (!supabase) return out;
  const { data, error } = await supabase
    .from("demo_trials")
    .select("id, vapi_assistant_id")
    .lt("expires_at", new Date().toISOString())
    .not("vapi_assistant_id", "is", null)
    .limit(50);
  if (error) return { ...out, errors: [`demo_trials okunamadı: ${error.message}`] };
  for (const row of (data ?? []) as { id: string; vapi_assistant_id: string }[]) {
    const res = await deleteAssistant(row.vapi_assistant_id);
    if (!res.ok) {
      out.errors.push(`Vapi deneme ${row.id}: ${res.error}`);
      continue;
    }
    const { error: e } = await supabase.from("demo_trials").update({ vapi_assistant_id: null }).eq("id", row.id);
    if (e) out.errors.push(`demo_trials ${row.id}: ${e.message}`);
    else out.retired++;
  }
  return out;
}


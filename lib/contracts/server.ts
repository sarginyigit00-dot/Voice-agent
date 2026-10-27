import { createHash } from "node:crypto";
import { after } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { PLANS, isPlan } from "@/lib/admin/constants";
import { sendContractCopy } from "@/lib/notify/email";
import {
  CONTRACT_VERSION,
  contractsAsText,
  renderContracts,
  type ContractDocument,
  type ContractProvider,
  type ContractTerms,
} from "@/lib/contracts/text";

type Supabase = NonNullable<ReturnType<typeof getSupabaseServer>>;

/**
 * Contracts accepted in the panel, server side.
 *
 * The operator fills a clinic's terms in /admin (clinic_contracts); the
 * clinic's staff then see both contracts filled with them and accept with two
 * ticks (components/app/contract-gate.tsx). Each acceptance stores the exact
 * documents shown, their SHA-256, who, when, from which IP — the evidence the
 * contracts' own delil clause (HMK md. 193) points at. A paper signature is
 * recorded the same way by the operator, method "paper".
 *
 * "Current" means the latest acceptance's hash matches the documents as they
 * render today — so a text change (CONTRACT_VERSION) or new terms (a price
 * change) both ask for a fresh acceptance, with no separate bookkeeping.
 *
 * The provider's identity comes from the environment, never the repo:
 * CONTRACT_PROVIDER_NAME, CONTRACT_PROVIDER_ADDRESS, CONTRACT_COURT (required),
 * CONTRACT_PROVIDER_ID, CONTRACT_PROVIDER_EMAIL, CONTRACT_GUARDIAN_CONSENT=1,
 * CONTRACT_COPY_EMAIL (the operator's copy of every acceptance).
 */

export function contractProvider(): ContractProvider | null {
  const env = (k: string) => process.env[k]?.trim() || "";
  const name = env("CONTRACT_PROVIDER_NAME");
  const address = env("CONTRACT_PROVIDER_ADDRESS");
  const court = env("CONTRACT_COURT");
  if (!name || !address || !court) return null;
  return {
    name,
    address,
    court,
    idNumber: env("CONTRACT_PROVIDER_ID") || null,
    email: env("CONTRACT_PROVIDER_EMAIL") || "info@randevoxai.com",
    guardianConsent: env("CONTRACT_GUARDIAN_CONSENT") === "1",
  };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The /admin form's terms, validated. */
export function parseContractTerms(raw: unknown): { terms: ContractTerms } | { error: string } {
  const f = (raw ?? {}) as Record<string, unknown>;
  const text = (k: string) => (typeof f[k] === "string" ? (f[k] as string).trim() : "");

  const terms: ContractTerms = {
    legalName: text("legalName"),
    taxId: text("taxId"),
    address: text("address"),
    email: text("email").toLowerCase(),
    monthlyFee: text("monthlyFee"),
    overageFee: text("overageFee"),
    setupFee: text("setupFee") || null,
    trialDays: null,
    paymentMethod: text("paymentMethod"),
    lineFeesBy: f.lineFeesBy === "provider" ? "provider" : "clinic",
  };
  if (!terms.legalName) return { error: "Kliniğin unvanı gerekli." };
  if (!terms.taxId) return { error: "Vergi dairesi / no gerekli." };
  if (!terms.address) return { error: "Kliniğin adresi gerekli." };
  if (!EMAIL.test(terms.email)) return { error: "Kliniğin bildirim e-postası geçersiz." };
  if (!terms.monthlyFee) return { error: "Aylık ücret gerekli (ör. 499 USD)." };
  if (!terms.overageFee) return { error: "Aşım ücreti gerekli (ör. 0,60 USD)." };
  if (!terms.paymentMethod) return { error: "Ödeme yöntemi gerekli." };

  const trial = text("trialDays");
  if (trial) {
    const n = Number(trial);
    if (!Number.isInteger(n) || n <= 0 || n > 90) return { error: "Deneme süresi 1–90 gün arası bir tam sayı olmalı." };
    terms.trialDays = n;
  }
  return { terms };
}

const digestOf = (docs: ContractDocument[]) =>
  createHash("sha256").update(`${CONTRACT_VERSION}\n${contractsAsText(docs)}`).digest("hex");

export interface ContractAcceptance {
  method: "click" | "paper";
  email: string | null;
  acceptedAt: string;
  version: string;
}

export type ContractState =
  /** No terms filled yet, or the provider env is missing: nothing to accept. */
  | { status: "none"; reason: string; accepted: ContractAcceptance | null }
  | {
      status: "required" | "accepted";
      documents: ContractDocument[];
      digest: string;
      version: string;
      terms: ContractTerms;
      /** The latest acceptance, current or not. */
      accepted: ContractAcceptance | null;
    };

export async function contractFor(supabase: Supabase, clinicId: string): Promise<ContractState> {
  const [clinic, row, last] = await Promise.all([
    supabase.from("clinics").select("plan, minutes_quota").eq("id", clinicId).maybeSingle(),
    supabase.from("clinic_contracts").select("terms").eq("clinic_id", clinicId).maybeSingle(),
    supabase
      .from("contract_acceptances")
      .select("method, email, accepted_at, version, digest")
      .eq("clinic_id", clinicId)
      .order("accepted_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (clinic.error) throw new Error(clinic.error.message);
  if (row.error) throw new Error(row.error.message);
  if (last.error) throw new Error(last.error.message);

  const accepted: ContractAcceptance | null = last.data
    ? { method: last.data.method, email: last.data.email, acceptedAt: last.data.accepted_at, version: last.data.version }
    : null;

  if (!clinic.data) return { status: "none", reason: "Klinik bulunamadı.", accepted };
  if (!row.data) return { status: "none", reason: "Sözleşme bilgileri girilmedi.", accepted };
  const provider = contractProvider();
  if (!provider) return { status: "none", reason: "CONTRACT_PROVIDER_NAME / _ADDRESS / CONTRACT_COURT ayarlı değil.", accepted };

  const parsed = parseContractTerms(row.data.terms);
  if ("error" in parsed) return { status: "none", reason: `Sözleşme bilgileri eksik: ${parsed.error}`, accepted };

  const plan = isPlan(clinic.data.plan) ? clinic.data.plan : "klinik";
  const documents = renderContracts({
    terms: parsed.terms,
    provider,
    pkg: { id: plan, label: PLANS[plan].label, minutes: clinic.data.minutes_quota },
  });
  const digest = digestOf(documents);
  return {
    status: last.data?.digest === digest ? "accepted" : "required",
    documents,
    digest,
    version: CONTRACT_VERSION,
    terms: parsed.terms,
    accepted,
  };
}

/** True when the clinic's latest acceptance (click or paper) covers today's documents. */
export async function hasCurrentContract(supabase: Supabase, clinicId: string): Promise<boolean> {
  return (await contractFor(supabase, clinicId)).status === "accepted";
}

/** The caller's address as Vercel passes it on. */
function clientIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || req.headers.get("x-real-ip") || null;
}

export async function recordAcceptance(input: {
  supabase: Supabase;
  clinicId: string;
  clinicName: string;
  method: "click" | "paper";
  /** The digest the browser saw — refused if the documents changed since. Paper: omit. */
  digest?: string;
  user?: { id: string; email: string | null };
  req?: Request;
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const { supabase, clinicId, method } = input;
  const state = await contractFor(supabase, clinicId);
  if (state.status === "none") return { ok: false, status: 409, error: state.reason };
  if (input.digest !== undefined && input.digest !== state.digest) {
    return { ok: false, status: 409, error: "Sözleşme siz okurken güncellendi. Sayfayı yenileyip yeni metni okuyun." };
  }

  const acceptedAt = new Date().toISOString();
  const ip = input.req ? clientIp(input.req) : null;
  const userAgent = input.req?.headers.get("user-agent")?.slice(0, 400) ?? null;
  const { error } = await supabase.from("contract_acceptances").insert({
    clinic_id: clinicId,
    method,
    user_id: input.user?.id ?? null,
    email: input.user?.email ?? null,
    version: state.version,
    digest: state.digest,
    document: state.documents,
    ip,
    user_agent: userAgent,
    accepted_at: acceptedAt,
  });
  if (error) return { ok: false, status: 500, error: error.message };

  if (method === "click") {
    const to = [input.user?.email, state.terms.email, process.env.CONTRACT_COPY_EMAIL?.trim()]
      .filter((e): e is string => !!e)
      .map((e) => e.toLowerCase())
      .filter((e, i, all) => all.indexOf(e) === i);
    const send = () =>
      sendContractCopy(to, state.documents, {
        clinicName: input.clinicName,
        email: input.user?.email ?? null,
        acceptedAt,
        ip,
        version: state.version,
        digest: state.digest,
      }).catch((e) => console.error("[contracts] copy mail failed:", e));
    try {
      after(send);
    } catch {
      void send();
    }
  }
  return { ok: true };
}

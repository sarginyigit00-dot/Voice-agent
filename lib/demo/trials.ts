import { randomBytes } from "node:crypto";
import { normalizeKnowledge, type ClinicKnowledge } from "@/lib/clinics/knowledge-shape";

/**
 * A prospective clinic's own web trial (/dene/<code>): its name and facts on
 * a browser-call assistant, no phone number. Pure rules here; storage in
 * lib/demo/trials-server.ts.
 */

export * from "@/lib/demo/trial-limits";

export interface TrialStatus {
  active: boolean;
  reason: "ok" | "expired" | "used_up";
  callsLeft: number;
  daysLeft: number;
}

export function trialStatus(t: { expiresAt: string; maxCalls: number }, used: number, now: Date = new Date()): TrialStatus {
  const msLeft = Date.parse(t.expiresAt) - now.getTime();
  const callsLeft = Math.max(0, t.maxCalls - used);
  const daysLeft = Math.max(0, Math.ceil(msLeft / 86_400_000));
  if (msLeft <= 0) return { active: false, reason: "expired", callsLeft, daysLeft: 0 };
  if (callsLeft === 0) return { active: false, reason: "used_up", callsLeft, daysLeft };
  return { active: true, reason: "ok", callsLeft, daysLeft };
}

/** Unguessable but short enough to read out: 10 chars of a-z0-9 without look-alikes. */
export function newTrialCode(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from(randomBytes(10), (b) => alphabet[b % alphabet.length]).join("");
}

export interface KnowledgeText {
  /** One per line: "Ad | fiyat | süre dk | açıklama" — only the name is required. */
  services: string;
  /** One per line: "Dt. Ad Soyad | uzmanlık". */
  doctors: string;
  address: string;
  faq: string;
}

const cells = (line: string) => line.split("|").map((c) => c.trim());
const num = (s: string | undefined) => {
  const n = Number.parseInt((s ?? "").replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};
const TITLES = ["Prof. Dr.", "Doç. Dr.", "Uzm. Dr.", "Uzm. Dt.", "Dr. Dt.", "Dr.", "Dt."];

/**
 * The operator types a clinic's facts as plain lines in /admin; this turns
 * them into the same shape /klinik saves, run through the same validator.
 */
export function parseKnowledgeText(t: KnowledgeText): ClinicKnowledge {
  const lines = (s: string) => s.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const services = lines(t.services).map((l) => {
    const [name, price, duration, description] = cells(l);
    return { name, specialty: "", price: num(price), durationMin: num(duration), description: description ?? "" };
  });
  const doctors = lines(t.doctors).map((l) => {
    const [full, specialty] = cells(l);
    const title = TITLES.find((x) => full.startsWith(`${x} `)) ?? "";
    return { title, name: title ? full.slice(title.length).trim() : full, specialty: specialty ?? "", notes: "", calcomEventTypeId: null };
  });
  return normalizeKnowledge({ services, doctors, address: t.address.trim(), faq: t.faq.trim() });
}

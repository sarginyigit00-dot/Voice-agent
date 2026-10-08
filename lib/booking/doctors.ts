import type { CalcomConfig } from "@/lib/calcom/client";
import { getKnowledge } from "@/lib/clinics/knowledge";
import type { KnowledgeDoctor } from "@/lib/clinics/knowledge-shape";
import type { ClinicContext } from "@/lib/clinics/server";

/**
 * Per-doctor calendars. A doctor on /klinik may carry their own Cal.com event
 * type; when a caller (or the panel) names that doctor, availability and the
 * booking go to that event type instead of the clinic's shared one. Anyone
 * else — no doctor named, a name we can't place, a doctor without a calendar —
 * stays on the shared calendar, so naming a doctor can never break a booking.
 */

/** "Şükrü Öztürk" → ["sukru", "ozturk"] — how names survive speech-to-text. */
export function nameTokens(raw: string): string[] {
  return raw
    .toLocaleLowerCase("tr-TR")
    .replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i").replace(/ö/g, "o").replace(/ş/g, "s").replace(/ü/g, "u")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .split(/[^a-z]+/)
    .filter((t) => t.length >= 2);
}

/**
 * The shorter of the two names must be fully contained in the longer one —
 * word by word, by prefix either way, since transcription clips and pads names
 * ("Sarı" / "Sarıy"). Patients book with a first name and call back with their
 * full name (or the other way round), so either side may be the shorter one;
 * the first real call failed exactly there ("Yiğit" booked, "Yiğit Sargın" said).
 * At least one matched word has to be a real name, not an initial.
 */
export function nameMatches(spoken: string, booked: string): boolean {
  const said = nameTokens(spoken);
  const have = nameTokens(booked);
  if (!said.length || !have.length) return false;
  const [shorter, longer] = said.length <= have.length ? [said, have] : [have, said];
  if (!shorter.some((t) => t.length >= 3)) return false;
  return shorter.every((t) => longer.some((l) => l.startsWith(t) || t.startsWith(l)));
}

export const doctorLabel = (d: Pick<KnowledgeDoctor, "title" | "name">) => [d.title, d.name].filter(Boolean).join(" ");

export interface ResolvedDoctor {
  /** Display name as the clinic wrote it ("Dt. Ayşe Kaya"); null when the name matched nobody. */
  label: string | null;
  /** The calendar to use: the doctor's own when they have one, otherwise the clinic's. */
  cfg: CalcomConfig;
  /** True when `cfg` is the doctor's own calendar. */
  own: boolean;
}

/**
 * Which calendar a request for `doctorName` goes to. A name that matches more
 * than one doctor is treated as unplaced rather than guessed.
 */
export async function resolveDoctor(
  clinic: ClinicContext | null,
  doctorName: string | null,
  base: CalcomConfig,
): Promise<ResolvedDoctor> {
  const fallback: ResolvedDoctor = { label: doctorName, cfg: base, own: false };
  if (!clinic || !doctorName) return fallback;

  const { doctors } = await getKnowledge(clinic.id);
  const matches = doctors.filter((d) => nameMatches(doctorName, doctorLabel(d)));
  if (matches.length !== 1) return fallback;

  const d = matches[0];
  const label = doctorLabel(d);
  // Per-doctor calendars are a Poliklinik feature; Klinik stays on the shared calendar.
  if (!d.calcomEventTypeId || clinic.plan !== "poliklinik") return { label, cfg: base, own: false };
  return { label, cfg: { ...base, eventTypeId: d.calcomEventTypeId }, own: true };
}

import type { L } from "@/lib/i18n/config";

/**
 * When the clinic is open, per agent.
 *
 * This is not decoration: lib/booking/tools.ts filters Cal.com's slots through
 * `isWithinHours` before offering any of them, and refuses a booking that
 * falls outside. Cal.com has its own availability schedule, but it belongs to
 * the calendar owner — this is the clinic's phone-line schedule, which is what
 * the agent must not book outside of.
 *
 * Times are wall-clock "HH:MM" strings in `timeZone`, so they survive DST
 * without anyone editing them.
 */

export const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type DayKey = (typeof DAY_KEYS)[number];

export interface DayHours {
  /** "09:00" */
  open: string;
  /** "18:00" — exclusive; a slot starting exactly at close is out. */
  close: string;
  closed: boolean;
}

export interface WorkingHours {
  timeZone: string;
  days: Record<DayKey, DayHours>;
}

export const DAY_LABEL: Record<DayKey, L> = {
  mon: { tr: "Pazartesi", en: "Monday" },
  tue: { tr: "Salı", en: "Tuesday" },
  wed: { tr: "Çarşamba", en: "Wednesday" },
  thu: { tr: "Perşembe", en: "Thursday" },
  fri: { tr: "Cuma", en: "Friday" },
  sat: { tr: "Cumartesi", en: "Saturday" },
  sun: { tr: "Pazar", en: "Sunday" },
};

/** Weekday-only 09:00–18:00, the shape most clinics start from. */
export function defaultWorkingHours(): WorkingHours {
  const weekday: DayHours = { open: "09:00", close: "18:00", closed: false };
  return {
    timeZone: "Europe/Istanbul",
    days: {
      mon: { ...weekday },
      tue: { ...weekday },
      wed: { ...weekday },
      thu: { ...weekday },
      fri: { ...weekday },
      sat: { open: "10:00", close: "14:00", closed: false },
      sun: { open: "09:00", close: "18:00", closed: true },
    },
  };
}

/**
 * Coerces whatever came back from the database into a usable shape. A row
 * written before this column existed, or hand-edited to something partial,
 * must not crash the booking path — it falls back to the default per field.
 */
export function normalizeWorkingHours(raw: unknown): WorkingHours {
  const fallback = defaultWorkingHours();
  if (!raw || typeof raw !== "object") return fallback;

  const input = raw as Partial<WorkingHours>;
  const days = {} as Record<DayKey, DayHours>;

  for (const key of DAY_KEYS) {
    const day = input.days?.[key];
    days[key] =
      day && typeof day.open === "string" && typeof day.close === "string"
        ? { open: day.open, close: day.close, closed: Boolean(day.closed) }
        : fallback.days[key];
  }

  return {
    timeZone: typeof input.timeZone === "string" && input.timeZone ? input.timeZone : fallback.timeZone,
    days,
  };
}

/** Minutes past midnight for "HH:MM"; null when unparseable. */
function toMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const hours = Number(m[1]);
  const mins = Number(m[2]);
  if (hours > 23 || mins > 59) return null;
  return hours * 60 + mins;
}

/** Which weekday and wall-clock minute an instant lands on, inside `timeZone`. */
function zonedParts(instant: Date, timeZone: string): { day: DayKey; minutes: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  );

  const lookup: Record<string, DayKey> = {
    Mon: "mon", Tue: "tue", Wed: "wed", Thu: "thu", Fri: "fri", Sat: "sat", Sun: "sun",
  };

  return {
    day: lookup[parts.weekday] ?? "mon",
    minutes: (Number(parts.hour) % 24) * 60 + Number(parts.minute),
  };
}

/** True when the clinic is open at this instant. */
export function isWithinHours(instant: Date, hours: WorkingHours): boolean {
  const { day, minutes } = zonedParts(instant, hours.timeZone);
  const window = hours.days[day];
  if (!window || window.closed) return false;

  const open = toMinutes(window.open);
  const close = toMinutes(window.close);
  // A malformed window must not silently close the clinic for good — treat it
  // as open and let Cal.com's own availability be the constraint.
  if (open === null || close === null || close <= open) return true;

  return minutes >= open && minutes < close;
}

/** The day's window, for telling a caller when we're actually open. */
export function hoursForDate(instant: Date, hours: WorkingHours): DayHours {
  return hours.days[zonedParts(instant, hours.timeZone).day];
}

/** "Pzt–Cum 09:00–18:00, Cmt 10:00–14:00" — a compact summary for the prompt. */
export function summarizeHours(hours: WorkingHours, lang: "tr" | "en" = "tr"): string {
  const open = DAY_KEYS.filter((d) => !hours.days[d].closed);
  if (!open.length) return lang === "tr" ? "Kapalı" : "Closed";

  return open
    .map((d) => `${DAY_LABEL[d][lang]} ${hours.days[d].open}–${hours.days[d].close}`)
    .join(", ");
}

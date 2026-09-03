/**
 * Cal.com API v2 client — the one place that knows Cal.com's wire format.
 *
 * Two endpoints, two API versions (Cal.com pins them per-endpoint):
 *   GET  /v2/slots     → cal-api-version: 2024-09-04
 *   POST /v2/bookings  → cal-api-version: 2024-08-13
 *
 * Everything here works in *instants* (UTC Date objects). Wall-clock parsing
 * lives in `toInstant` because the LLM routinely hands us "2026-08-29T10:00"
 * with no offset, which `new Date()` would silently read as the *server's*
 * timezone (UTC on Vercel) — three hours off for an Istanbul clinic.
 */

const SLOTS_API_VERSION = "2024-09-04";
const BOOKINGS_API_VERSION = "2024-08-13";
const CANCEL_API_VERSION = "2026-02-25";

export interface CalcomConfig {
  apiKey: string;
  eventTypeId: number;
  timeZone: string;
  /** Where Cal.com sends the confirmation when the caller gave no email. */
  fallbackEmail: string | null;
}

/** Null when Cal.com isn't configured — callers degrade to demo mode. */
export function calcomConfig(): CalcomConfig | null {
  const apiKey = process.env.CALCOM_API_KEY;
  const eventTypeId = Number(process.env.CALCOM_EVENT_TYPE_ID);
  if (!apiKey || !Number.isFinite(eventTypeId) || eventTypeId <= 0) return null;

  return {
    apiKey,
    eventTypeId,
    timeZone: process.env.BOOKING_TIMEZONE || "Europe/Istanbul",
    fallbackEmail: process.env.BOOKING_FALLBACK_EMAIL || null,
  };
}

/* ─────────────────────────── timezone helpers ─────────────────────────── */

/** Minutes `timeZone` is ahead of UTC at this instant (DST-correct). */
function offsetMinutes(instant: Date, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  return (asUtc - instant.getTime()) / 60000;
}

/**
 * Parses whatever the model produced into a real instant.
 *
 * With an explicit offset or trailing Z we trust it. Without one — the common
 * case, since an LLM told "book 10:00" writes "2026-08-29T10:00:00" — we read
 * it as wall-clock time in `timeZone`. Returns null on anything unparseable
 * rather than guessing, so the caller can ask the patient again.
 */
export function toInstant(raw: string, timeZone: string): Date | null {
  const value = String(raw ?? "").trim();
  if (!value) return null;

  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);
  if (hasZone) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // A bare date ("2026-08-29") carries no time of day — that isn't a slot.
  if (!/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(value)) return null;

  const naive = new Date(value.replace(" ", "T") + "Z");
  if (Number.isNaN(naive.getTime())) return null;

  // Subtract the zone's offset to get the instant, then re-check once so a
  // slot on a DST boundary resolves against the offset actually in effect.
  const first = new Date(naive.getTime() - offsetMinutes(naive, timeZone) * 60000);
  return new Date(naive.getTime() - offsetMinutes(first, timeZone) * 60000);
}

/** "29 Ağustos Cumartesi 10:00" — what the agent reads back to the caller. */
export function speakInstant(instant: Date, timeZone: string, lang: "tr" | "en" = "tr"): string {
  return new Intl.DateTimeFormat(lang === "tr" ? "tr-TR" : "en-GB", {
    timeZone,
    day: "numeric",
    month: "long",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(instant);
}

/* ───────────────────────────── slots ───────────────────────────── */

export type CalcomResult<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Free slots between two instants, as ISO strings straight from Cal.com.
 * Cal.com groups them by date; we flatten and sort, since the agent only ever
 * wants "the next few openings".
 */
export async function getSlots(
  cfg: CalcomConfig,
  range: { start: Date; end: Date },
): Promise<CalcomResult<string[]>> {
  const url = new URL("https://api.cal.com/v2/slots");
  url.searchParams.set("eventTypeId", String(cfg.eventTypeId));
  url.searchParams.set("start", range.start.toISOString());
  url.searchParams.set("end", range.end.toISOString());
  url.searchParams.set("timeZone", cfg.timeZone);

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        "cal-api-version": SLOTS_API_VERSION,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 140);
      return { ok: false, error: `Cal.com uygunluk sorgusu başarısız (${res.status}): ${detail}` };
    }

    const body = await res.json();
    // { status: "success", data: { "2026-08-29": [{ start: "..." }, ...] } }
    const byDate = (body?.data ?? {}) as Record<string, { start: string }[]>;
    const slots = Object.values(byDate)
      .flat()
      .map((s) => s?.start)
      .filter((s): s is string => typeof s === "string")
      .sort();

    return { ok: true, data: slots };
  } catch (e) {
    return { ok: false, error: `Cal.com sunucusuna ulaşılamadı: ${(e as Error).message}` };
  }
}

/* ──────────────────────────── bookings ──────────────────────────── */

export interface BookingRequest {
  start: Date;
  name: string;
  /** The caller's real address, when they gave one. */
  email?: string | null;
  phone?: string | null;
  notes?: string;
  metadata?: Record<string, string>;
  lang?: "tr" | "en";
}

export interface BookingConfirmation {
  uid: string;
  start: string;
}

/**
 * Cal.com caps metadata at 50 keys, 40 chars per key, 500 chars per value, and
 * rejects the booking if any of those is exceeded. A long transcript-derived
 * note must not be what costs a patient their appointment, so trim instead.
 */
function sanitizeMetadata(raw: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(raw)
      .filter(([, v]) => typeof v === "string" && v.length > 0)
      .slice(0, 50)
      .map(([k, v]) => [k.slice(0, 40), v.slice(0, 500)]),
  );
}

export async function createBooking(
  cfg: CalcomConfig,
  req: BookingRequest,
): Promise<CalcomResult<BookingConfirmation>> {
  const email = req.email?.trim() || cfg.fallbackEmail;
  if (!email) {
    return {
      ok: false,
      error: "Randevu için e-posta gerekiyor: arayan e-posta vermedi ve BOOKING_FALLBACK_EMAIL tanımlı değil.",
    };
  }

  try {
    const res = await fetch("https://api.cal.com/v2/bookings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        "cal-api-version": BOOKINGS_API_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        eventTypeId: cfg.eventTypeId,
        start: req.start.toISOString(),
        attendee: {
          name: req.name || "Telefonla arayan",
          email,
          phoneNumber: req.phone || undefined,
          timeZone: cfg.timeZone,
          language: req.lang ?? "tr",
        },
        // Notes ride in metadata rather than `bookingFieldsResponses`: that
        // field is keyed by the slugs configured on the event type, and
        // sending one that isn't configured rejects the whole booking. The
        // phone number is already on the attendee record above.
        metadata: sanitizeMetadata({ ...req.metadata, ...(req.notes ? { notes: req.notes } : {}) }),
      }),
    });

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 140);
      return { ok: false, error: `Cal.com randevuyu reddetti (${res.status}): ${detail}` };
    }

    const body = await res.json().catch(() => null);
    const data = body?.data ?? body;
    const uid = data?.uid ?? data?.id;
    if (!uid) return { ok: false, error: "Cal.com yanıtında randevu kimliği (uid) yok." };

    return { ok: true, data: { uid: String(uid), start: data?.start ?? req.start.toISOString() } };
  } catch (e) {
    return { ok: false, error: `Cal.com sunucusuna ulaşılamadı: ${(e as Error).message}` };
  }
}

/**
 * Cancels a booking on Cal.com. Note the different pinned version — Cal.com
 * versions `/cancel` separately from `/bookings`.
 *
 * The dashboard cancels here FIRST and only writes `status = 'cancelled'`
 * locally once this succeeds, so a row marked cancelled in our table is always
 * cancelled on the real calendar too. The opposite order would quietly leave
 * patients holding appointments nobody can see.
 */
export async function cancelBooking(
  cfg: CalcomConfig,
  bookingUid: string,
  reason?: string,
): Promise<CalcomResult<null>> {
  try {
    const res = await fetch(`https://api.cal.com/v2/bookings/${encodeURIComponent(bookingUid)}/cancel`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        "cal-api-version": CANCEL_API_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ cancellationReason: reason || "Klinik tarafından iptal edildi" }),
    });

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 200);
      return { ok: false, error: `Cal.com iptali reddetti (${res.status}): ${detail}` };
    }
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: `Cal.com sunucusuna ulaşılamadı: ${(e as Error).message}` };
  }
}

/**
 * Reschedules a booking to a new time. Cal.com doesn't move the existing
 * booking — it creates a brand new one (a new `uid`) and marks the old one
 * as superseded, which is why the caller must swap its stored `booking_uid`
 * for the one this returns rather than keeping the original.
 */
export async function rescheduleBooking(
  cfg: CalcomConfig,
  bookingUid: string,
  newStart: Date,
  reason?: string,
): Promise<CalcomResult<BookingConfirmation>> {
  try {
    const res = await fetch(`https://api.cal.com/v2/bookings/${encodeURIComponent(bookingUid)}/reschedule`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        "cal-api-version": CANCEL_API_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        start: newStart.toISOString(),
        reschedulingReason: reason || "Klinik tarafından yeniden planlandı",
      }),
    });

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 200);
      return { ok: false, error: `Cal.com ertelemeyi reddetti (${res.status}): ${detail}` };
    }

    const body = await res.json().catch(() => null);
    const data = body?.data ?? body;
    const uid = data?.uid;
    if (!uid) return { ok: false, error: "Cal.com yanıtında yeni randevu kimliği (uid) yok." };

    return { ok: true, data: { uid: String(uid), start: data?.start ?? newStart.toISOString() } };
  } catch (e) {
    return { ok: false, error: `Cal.com sunucusuna ulaşılamadı: ${(e as Error).message}` };
  }
}

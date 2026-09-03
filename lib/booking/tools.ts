import {
  calcomConfig,
  createBooking,
  getSlots,
  speakInstant,
  toInstant,
} from "@/lib/calcom/client";
import { findByCall, record } from "@/lib/booking/store";
import { hoursForDate, isWithinHours, summarizeHours, type WorkingHours } from "@/lib/agents/hours";

/**
 * The two tools the voice agent calls **while the caller is still on the
 * line**, via Vapi's `tool-calls` server message.
 *
 * This is the part that was missing. Booking used to happen after the call,
 * from a summary, which meant the agent could never check availability or
 * confirm a time to the patient — it just asserted a booking had happened and
 * then wrote it at the wrong timestamp. Now the agent asks Cal.com for real
 * openings, offers them, and books the one the patient picks before hanging up.
 *
 * Declare both on the Vapi assistant as tools whose server URL is
 * /api/vapi/webhook. Every handler returns a JSON string, which is what Vapi
 * feeds back to the model as the tool result.
 */

export const BOOKING_TOOL_NAMES = ["check_availability", "book_appointment"] as const;
export type BookingToolName = (typeof BOOKING_TOOL_NAMES)[number];

export function isBookingTool(name: string): name is BookingToolName {
  return (BOOKING_TOOL_NAMES as readonly string[]).includes(name);
}

/** Who is on the phone — taken from the Vapi call object, never from the model. */
export interface ToolContext {
  callId: string;
  callerNumber: string;
  callerName: string;
  agentId: string;
  /**
   * This line's schedule. Cal.com's own availability is the calendar owner's;
   * this is the clinic's phone-line schedule, and slots outside it are never
   * offered or accepted no matter what Cal.com returns.
   */
  workingHours: WorkingHours;
}

/** How many openings we read out at once. More than this is unusable by voice. */
const MAX_SPOKEN_SLOTS = 4;
/** How far ahead "when are you free?" looks when no date is given. */
const DEFAULT_LOOKAHEAD_DAYS = 7;

type ToolArgs = Record<string, unknown>;

function str(args: ToolArgs, key: string): string | null {
  const v = args?.[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/* ─────────────────────── check_availability ─────────────────────── */

/**
 * Args: { date?: "YYYY-MM-DD" } — a specific day the patient asked about, or
 * omitted for "the next opening you have".
 */
export async function checkAvailability(args: ToolArgs, ctx: ToolContext): Promise<string> {
  const cfg = calcomConfig();
  if (!cfg) {
    return JSON.stringify({
      ok: false,
      spoken: "Takvim sistemine şu anda bağlanamıyorum. Sizi bir yetkiliye aktarayım.",
    });
  }

  const now = new Date();
  const date = str(args, "date");

  let start: Date;
  let end: Date;

  if (date) {
    const dayStart = toInstant(`${date}T00:00:00`, cfg.timeZone);
    if (!dayStart) {
      return JSON.stringify({
        ok: false,
        spoken: "Hangi günü sorduğunuzu tam anlayamadım, tekrar söyleyebilir misiniz?",
      });
    }
    // Never offer a slot that has already passed today.
    start = dayStart.getTime() < now.getTime() ? now : dayStart;
    end = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    if (end.getTime() <= now.getTime()) {
      return JSON.stringify({
        ok: false,
        spoken: "O tarih geçmişte kalmış. Önümüzdeki günler için bakayım mı?",
      });
    }

    // Closed that day — say so up front instead of returning an empty list,
    // which the model tends to read out as "we're fully booked".
    if (hoursForDate(dayStart, ctx.workingHours).closed) {
      return JSON.stringify({
        ok: false,
        closed: true,
        spoken: `O gün kapalıyız. Açık olduğumuz saatler: ${summarizeHours(ctx.workingHours)}. Başka bir güne bakmamı ister misiniz?`,
      });
    }
  } else {
    start = now;
    end = new Date(now.getTime() + DEFAULT_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000);
  }

  const slots = await getSlots(cfg, { start, end });
  if (!slots.ok) {
    console.error("[booking] check_availability failed:", slots.error);
    return JSON.stringify({
      ok: false,
      spoken: "Takvimi şu an sorgulayamadım. Bir yetkiliye aktarabilirim ya da sizi geri arayabiliriz.",
    });
  }

  // Cal.com answers for the calendar owner's availability; the clinic's phone
  // line has its own hours, and only the intersection is bookable.
  const upcoming = slots.data.filter(
    (s) => Date.parse(s) > now.getTime() && isWithinHours(new Date(s), ctx.workingHours),
  );
  if (!upcoming.length) {
    return JSON.stringify({
      ok: false,
      spoken: date
        ? "O gün için boş yerimiz kalmamış. Başka bir güne bakmamı ister misiniz?"
        : "Önümüzdeki hafta için boş yerimiz görünmüyor. Sizi bir yetkiliye aktarayım.",
    });
  }

  const offered = upcoming.slice(0, MAX_SPOKEN_SLOTS);
  return JSON.stringify({
    ok: true,
    // ISO values are what book_appointment must be called back with — the
    // spoken forms are only for reading out loud.
    slots: offered,
    spoken: offered.map((s) => speakInstant(new Date(s), cfg.timeZone)),
    note: "Hastaya bu saatleri oku. Seçtiği saati book_appointment'a slots dizisindeki ISO değeriyle gönder.",
  });
}

/* ─────────────────────── book_appointment ─────────────────────── */

/**
 * Args: { start: ISO-8601, name?, email?, notes? }
 *
 * `start` must be one of the ISO values check_availability returned. We
 * re-verify it against Cal.com anyway — the model can hallucinate a time, and
 * a slot can be taken by someone else between the two calls.
 */
export async function bookAppointment(args: ToolArgs, ctx: ToolContext): Promise<string> {
  const cfg = calcomConfig();
  if (!cfg) {
    return JSON.stringify({
      ok: false,
      spoken: "Randevu sistemine şu anda bağlanamıyorum. Sizi bir yetkiliye aktarayım.",
    });
  }

  // Already booked on this call — the model asked twice, or Vapi retried.
  const existing = await findByCall(ctx.callId);
  if (existing) {
    return JSON.stringify({
      ok: true,
      alreadyBooked: true,
      bookingUid: existing.bookingUid,
      spoken: `Randevunuz zaten ${speakInstant(new Date(existing.startsAt), cfg.timeZone)} için oluşturuldu.`,
    });
  }

  const rawStart = str(args, "start");
  if (!rawStart) {
    return JSON.stringify({ ok: false, spoken: "Hangi saati istediğinizi tekrar alabilir miyim?" });
  }

  const start = toInstant(rawStart, cfg.timeZone);
  if (!start) {
    return JSON.stringify({ ok: false, spoken: "Saati anlayamadım, tekrar söyleyebilir misiniz?" });
  }

  if (start.getTime() <= Date.now()) {
    return JSON.stringify({
      ok: false,
      spoken: "O saat geçmiş görünüyor. Size uygun ilk saatleri tekrar söyleyeyim mi?",
    });
  }

  // The last line of defence on working hours: a model that skipped
  // check_availability, or picked a time it invented, stops here.
  if (!isWithinHours(start, ctx.workingHours)) {
    return JSON.stringify({
      ok: false,
      outsideHours: true,
      spoken: `O saatte kapalıyız. Açık olduğumuz saatler: ${summarizeHours(ctx.workingHours)}. Bu saatler içinde bir zaman seçelim mi?`,
    });
  }

  // Re-verify the slot is genuinely open before promising it to the patient.
  const dayEnd = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const slots = await getSlots(cfg, { start: new Date(start.getTime() - 1000), end: dayEnd });
  if (slots.ok && !slots.data.some((s) => Date.parse(s) === start.getTime())) {
    const alternatives = slots.data
      .filter((s) => Date.parse(s) > Date.now() && isWithinHours(new Date(s), ctx.workingHours))
      .slice(0, MAX_SPOKEN_SLOTS);
    return JSON.stringify({
      ok: false,
      slots: alternatives,
      spoken: alternatives.length
        ? "O saat maalesef dolmuş. Şu saatler boş, hangisi uygun olur?"
        : "O saat maalesef dolmuş. Başka bir güne bakmamı ister misiniz?",
      alternativesSpoken: alternatives.map((s) => speakInstant(new Date(s), cfg.timeZone)),
    });
  }

  const name = str(args, "name") ?? (ctx.callerName !== "Unknown" ? ctx.callerName : "Telefonla arayan");
  const email = str(args, "email");
  const notes = str(args, "notes");

  const booking = await createBooking(cfg, {
    start,
    name,
    email,
    phone: ctx.callerNumber || null,
    // Without an email from the patient the confirmation goes to the clinic's
    // inbox, so the phone number has to be visible on the booking itself.
    notes: [notes, ctx.callerNumber ? `Telefon: ${ctx.callerNumber}` : null]
      .filter(Boolean)
      .join(" · "),
    metadata: { callId: ctx.callId, source: "randevox-voice" },
  });

  if (!booking.ok) {
    console.error("[booking] book_appointment failed:", booking.error);
    return JSON.stringify({
      ok: false,
      spoken: "Randevuyu kaydederken bir sorun oldu. Sizi bir yetkiliye aktarayım.",
    });
  }

  await record({
    callId: ctx.callId,
    bookingUid: booking.data.uid,
    startsAt: start.toISOString(),
    attendeeName: name,
    attendeeEmail: email,
    attendeePhone: ctx.callerNumber || null,
    agentId: ctx.agentId,
    source: "in-call",
  });

  return JSON.stringify({
    ok: true,
    bookingUid: booking.data.uid,
    spoken: `Randevunuzu ${speakInstant(start, cfg.timeZone)} için oluşturdum.`,
  });
}

/* ───────────────────────────── dispatch ───────────────────────────── */

export async function runBookingTool(
  name: BookingToolName,
  args: ToolArgs,
  ctx: ToolContext,
): Promise<string> {
  switch (name) {
    case "check_availability":
      return checkAvailability(args, ctx);
    case "book_appointment":
      return bookAppointment(args, ctx);
  }
}

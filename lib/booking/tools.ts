import {
  calcomConfigFor,
  createBooking,
  getSlots,
  toInstant,
  type CalcomConfig,
} from "@/lib/calcom/client";
import { speakHours, speakInstantTr } from "@/lib/speech/tr";
import { findByCall, record } from "@/lib/booking/store";
import { hoursForDate, isWithinHours, type WorkingHours } from "@/lib/agents/hours";
import type { ClinicContext } from "@/lib/clinics/server";
import {
  appointmentFor,
  cancelAppointment,
  rescheduleAppointment,
  upcomingFor,
} from "@/lib/appointments/manage";

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

export const BOOKING_TOOL_NAMES = [
  "check_availability",
  "book_appointment",
  "find_appointment",
  "cancel_appointment",
  "reschedule_appointment",
] as const;
export type BookingToolName = (typeof BOOKING_TOOL_NAMES)[number];

export function isBookingTool(name: string): name is BookingToolName {
  return (BOOKING_TOOL_NAMES as readonly string[]).includes(name);
}

/** Who is on the phone — taken from the Vapi call object, never from the model. */
export interface ToolContext {
  /** The clinic whose calendar this call books into — from the Vapi assistant, never from the model. */
  clinic: ClinicContext | null;
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

/**
 * "21 Eylül" said on the phone never means a past year, but the model
 * sometimes sends one ("2021-09-21"). Move such a day to this year — or
 * next year if it has already gone by — and leave anything else untouched.
 */
function withCurrentYear(date: string | null, now: Date): string | null {
  const m = date?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!date || !m || Number(m[1]) >= now.getUTCFullYear()) return date;
  const thisYear = `${now.getUTCFullYear()}-${m[2]}-${m[3]}`;
  const today = now.toISOString().slice(0, 10);
  return thisYear >= today ? thisYear : `${now.getUTCFullYear() + 1}-${m[2]}-${m[3]}`;
}

/* ─────────────────────── check_availability ─────────────────────── */

/**
 * Args: { date?: "YYYY-MM-DD" } — a specific day the patient asked about, or
 * omitted for "the next opening you have".
 */
export async function checkAvailability(args: ToolArgs, ctx: ToolContext): Promise<string> {
  const cfg = await calcomConfigFor(ctx.clinic);
  if (!cfg) {
    return JSON.stringify({
      ok: false,
      spoken: "Takvim sistemine şu anda bağlanamıyorum. Sizi bir yetkiliye aktarayım.",
    });
  }

  const now = new Date();
  const date = withCurrentYear(str(args, "date"), now);

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
        spoken: `O gün kapalıyız. Açık olduğumuz saatler: ${speakHours(ctx.workingHours)}. Başka bir güne bakmamı ister misiniz?`,
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
    spoken: offered.map((s) => speakInstantTr(new Date(s), cfg.timeZone)),
    note: "Hastaya bu saatleri oku. Seçtiği saati book_appointment'a slots dizisindeki ISO değeriyle gönder.",
  });
}

/**
 * Everything a requested time must pass before a patient is promised it:
 * readable, in the future, inside this line's working hours, and genuinely
 * still open on Cal.com — the model can hallucinate a time, and a slot can be
 * taken between check_availability and the booking. Shared by booking and
 * rescheduling, so a moved appointment is held to the same bar as a new one.
 */
async function checkRequestedSlot(
  rawStart: string,
  cfg: CalcomConfig,
  ctx: ToolContext,
): Promise<{ start: Date } | { fail: string }> {
  const start = toInstant(rawStart, cfg.timeZone);
  if (!start) {
    return { fail: JSON.stringify({ ok: false, spoken: "Saati anlayamadım, tekrar söyleyebilir misiniz?" }) };
  }

  if (start.getTime() <= Date.now()) {
    return {
      fail: JSON.stringify({
        ok: false,
        spoken: "O saat geçmiş görünüyor. Size uygun ilk saatleri tekrar söyleyeyim mi?",
      }),
    };
  }

  // The last line of defence on working hours: a model that skipped
  // check_availability, or picked a time it invented, stops here.
  if (!isWithinHours(start, ctx.workingHours)) {
    return {
      fail: JSON.stringify({
        ok: false,
        outsideHours: true,
        spoken: `O saatte kapalıyız. Açık olduğumuz saatler: ${speakHours(ctx.workingHours)}. Bu saatler içinde bir zaman seçelim mi?`,
      }),
    };
  }

  const dayEnd = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const slots = await getSlots(cfg, { start: new Date(start.getTime() - 1000), end: dayEnd });
  if (slots.ok && !slots.data.some((s) => Date.parse(s) === start.getTime())) {
    const alternatives = slots.data
      .filter((s) => Date.parse(s) > Date.now() && isWithinHours(new Date(s), ctx.workingHours))
      .slice(0, MAX_SPOKEN_SLOTS);
    return {
      fail: JSON.stringify({
        ok: false,
        slots: alternatives,
        spoken: alternatives.length
          ? "O saat maalesef dolmuş. Şu saatler boş, hangisi uygun olur?"
          : "O saat maalesef dolmuş. Başka bir güne bakmamı ister misiniz?",
        alternativesSpoken: alternatives.map((s) => speakInstantTr(new Date(s), cfg.timeZone)),
      }),
    };
  }

  return { start };
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
  const cfg = await calcomConfigFor(ctx.clinic);
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
      spoken: `Randevunuz zaten ${speakInstantTr(new Date(existing.startsAt), cfg.timeZone)} için oluşturuldu.`,
    });
  }

  const rawStart = str(args, "start");
  if (!rawStart) {
    return JSON.stringify({ ok: false, spoken: "Hangi saati istediğinizi tekrar alabilir miyim?" });
  }

  const checked = await checkRequestedSlot(rawStart, cfg, ctx);
  if ("fail" in checked) return checked.fail;
  const { start } = checked;

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
    clinicId: ctx.clinic?.id ?? null,
    source: "in-call",
  });

  return JSON.stringify({
    ok: true,
    bookingUid: booking.data.uid,
    spoken: `Randevunuzu ${speakInstantTr(start, cfg.timeZone)} için oluşturdum.`,
  });
}

/* ─────────────── find / cancel / reschedule (patient calls in) ─────────────── */

/**
 * A patient calling to cancel or move their appointment.
 *
 * Identity is the hard part: the line doesn't pass the caller's number yet
 * (Netgsm), so a patient is matched on **name AND day, both required** — the
 * way a receptionist does it. Asking for the day as well is what keeps this
 * from reading out a stranger's appointment to anyone who knows a name: the
 * tool only ever confirms what the caller already said. When a caller number
 * does arrive, it narrows the match further; it never widens it.
 */

/** "Şükrü Öztürk" → ["sukru", "ozturk"] — how names survive speech-to-text. */
function nameTokens(raw: string): string[] {
  return raw
    .toLocaleLowerCase("tr-TR")
    .replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i").replace(/ö/g, "o").replace(/ş/g, "s").replace(/ü/g, "u")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
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
function nameMatches(spoken: string, booked: string): boolean {
  const said = nameTokens(spoken);
  const have = nameTokens(booked);
  if (!said.length || !have.length) return false;
  const [shorter, longer] = said.length <= have.length ? [said, have] : [have, said];
  if (!shorter.some((t) => t.length >= 3)) return false;
  return shorter.every((t) => longer.some((l) => l.startsWith(t) || t.startsWith(l)));
}

const CALLER_SIDE = "hasta, telefonla";

/**
 * Args: { name: string, date: "YYYY-MM-DD" } — both required.
 * Returns the matching booked appointment's id for cancel/reschedule.
 */
async function findAppointment(args: ToolArgs, ctx: ToolContext): Promise<string> {
  const cfg = await calcomConfigFor(ctx.clinic);
  if (!cfg || !ctx.clinic) {
    return JSON.stringify({ ok: false, spoken: "Randevu sistemine şu anda bağlanamıyorum. Notunuzu alayım, klinik sizi arasın." });
  }

  const name = str(args, "name");
  const date = withCurrentYear(str(args, "date"), new Date());
  if (!name || !date) {
    return JSON.stringify({
      ok: false,
      spoken: "Randevunuzu bulabilmem için adınızı soyadınızı ve randevunuzun hangi gün olduğunu söyler misiniz?",
    });
  }

  const dayStart = toInstant(`${date}T00:00:00`, cfg.timeZone);
  if (!dayStart) {
    return JSON.stringify({ ok: false, spoken: "Hangi günü söylediğinizi tam anlayamadım, tekrar söyleyebilir misiniz?" });
  }
  const now = new Date();
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  if (dayEnd.getTime() <= now.getTime()) {
    return JSON.stringify({ ok: false, spoken: "O gün geçmişte kalmış. İleriye dönük bir randevunuz için mi aradınız?" });
  }

  const onThatDay = await upcomingFor(ctx.clinic, dayStart.getTime() < now.getTime() ? now : dayStart, dayEnd);
  let matches = onThatDay.filter((a) => nameMatches(name, a.attendee_name));
  // A caller number, when the line passes one, may only narrow the match.
  const caller = ctx.callerNumber.replace(/\D/g, "").slice(-10);
  if (caller && matches.length > 1) {
    const byPhone = matches.filter((a) => (a.attendee_phone ?? "").replace(/\D/g, "").slice(-10) === caller);
    if (byPhone.length) matches = byPhone;
  }

  if (!matches.length) {
    return JSON.stringify({
      ok: false,
      // The day is usually right — a misheard or differently given name is the
      // common miss — so ask about the name only, once.
      spoken: "O gün için bu isimle bir randevu bulamadım. Randevuyu hangi isimle almıştınız?",
      note: "Günü tekrar sorma. Arayan farklı bir isim söylerse bir kez daha dene; yine bulunamazsa notunu al ve kliniğin geri döneceğini söyle.",
    });
  }
  if (matches.length > 1) {
    return JSON.stringify({
      ok: false,
      spoken: "O gün bu isimle birden fazla randevu var. Soyadınızı da söyler misiniz?",
    });
  }

  const found = matches[0];
  return JSON.stringify({
    ok: true,
    appointmentId: found.id,
    spoken: `${speakInstantTr(new Date(found.starts_at), cfg.timeZone)} randevunuzu buldum.`,
    note: "Randevuyu bu cümleyle oku ve iptal mi erteleme mi istediğini açıkça teyit ettir. Teyit almadan cancel_appointment ya da reschedule_appointment çağırma.",
  });
}

/** Args: { appointmentId } — an id find_appointment returned on this call. */
async function cancelByPhone(args: ToolArgs, ctx: ToolContext): Promise<string> {
  const cfg = await calcomConfigFor(ctx.clinic);
  const id = str(args, "appointmentId");
  const appointment = cfg && ctx.clinic && id ? await appointmentFor(ctx.clinic, id) : null;
  // Only an upcoming appointment of THIS clinic — an id from anywhere else is simply not found.
  if (!cfg || !ctx.clinic || !appointment || Date.parse(appointment.starts_at) <= Date.now()) {
    return JSON.stringify({ ok: false, spoken: "Randevunuzu şu an bulamadım. Adınızı ve randevu gününüzü tekrar alabilir miyim?" });
  }

  const result = await cancelAppointment(ctx.clinic, appointment, CALLER_SIDE);
  if (!result.ok) {
    console.error("[booking] cancel_appointment failed:", result.error);
    return JSON.stringify({ ok: false, spoken: "İptal ederken bir sorun oldu. Notunuzu alayım, klinik sizi en kısa sürede arasın." });
  }
  return JSON.stringify({
    ok: true,
    spoken: `${speakInstantTr(new Date(appointment.starts_at), cfg.timeZone)} randevunuzu iptal ettim.`,
  });
}

/** Args: { appointmentId, start: ISO from check_availability } */
async function rescheduleByPhone(args: ToolArgs, ctx: ToolContext): Promise<string> {
  const cfg = await calcomConfigFor(ctx.clinic);
  const id = str(args, "appointmentId");
  const appointment = cfg && ctx.clinic && id ? await appointmentFor(ctx.clinic, id) : null;
  if (!cfg || !ctx.clinic || !appointment || appointment.status !== "booked" || Date.parse(appointment.starts_at) <= Date.now()) {
    return JSON.stringify({ ok: false, spoken: "Randevunuzu şu an bulamadım. Adınızı ve randevu gününüzü tekrar alabilir miyim?" });
  }

  const rawStart = str(args, "start");
  if (!rawStart) {
    return JSON.stringify({ ok: false, spoken: "Hangi saate almak istediğinizi söyler misiniz?" });
  }
  const checked = await checkRequestedSlot(rawStart, cfg, ctx);
  if ("fail" in checked) return checked.fail;

  const result = await rescheduleAppointment(ctx.clinic, appointment, checked.start, CALLER_SIDE);
  if (!result.ok) {
    console.error("[booking] reschedule_appointment failed:", result.error);
    return JSON.stringify({ ok: false, spoken: "Randevuyu değiştirirken bir sorun oldu. Notunuzu alayım, klinik sizi en kısa sürede arasın." });
  }
  return JSON.stringify({
    ok: true,
    spoken: `Randevunuzu ${speakInstantTr(checked.start, cfg.timeZone)} olarak değiştirdim.`,
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
    case "find_appointment":
      return findAppointment(args, ctx);
    case "cancel_appointment":
      return cancelByPhone(args, ctx);
    case "reschedule_appointment":
      return rescheduleByPhone(args, ctx);
  }
}

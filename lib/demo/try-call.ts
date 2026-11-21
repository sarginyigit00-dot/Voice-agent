import { speakHours, speakInstantTr } from "@/lib/speech/tr";
import { defaultWorkingHours } from "@/lib/agents/hours";

/**
 * The landing page's "talk to the agent now" browser call (#dene,
 * components/marketing/try-call.tsx). The visitor speaks to one fixed demo
 * assistant (scripts/sync-demo-assistant.ts) for a sample clinic that does
 * not exist — it is deliberately NOT a row in `agents`, so nothing it hears
 * can land in `calls`, `crm_records` or `appointments`.
 *
 * Its booking tools hit the real webhook, which recognises the assistant by
 * VAPI_DEMO_ASSISTANT_ID and answers from here: plausible openings, a
 * "booked" that books nothing.
 */

export const DEMO_CLINIC_NAME = "Örnek Diş Kliniği";
export const DEMO_TIME_ZONE = "Europe/Istanbul";
/** Hard cap on one browser call, enforced by Vapi (maxDurationSeconds). */
export const DEMO_CALL_MAX_SECONDS = 180;
/** Calls one visitor (IP) may start per day. */
export const DEMO_CALLS_PER_IP_PER_DAY = 3;
/** Fallback for DEMO_CALL_DAILY_CAP: worst case ~60 min ≈ $10 a day. */
export const DEFAULT_DEMO_DAILY_CAP = 20;

export function demoAssistantId(): string | null {
  return process.env.VAPI_DEMO_ASSISTANT_ID?.trim() || null;
}

export function isDemoAssistant(assistantId: string | undefined): boolean {
  const id = demoAssistantId();
  return Boolean(id && assistantId === id);
}

export function demoDailyCap(): number {
  const n = Number.parseInt(process.env.DEMO_CALL_DAILY_CAP ?? "", 10);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_DEMO_DAILY_CAP;
}

/* ───────────────────────── sample calendar ───────────────────────── */

/** Istanbul has no DST — a fixed +03:00 keeps this free of time-zone maths. */
const OFFSET = "+03:00";
/** Opening slots offered on any open day, local time. */
const SLOT_TIMES = ["10:00", "11:30", "14:00", "16:30"];

function istanbulYmd(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: DEMO_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** Sunday is the sample clinic's day off. */
function isClosed(ymd: string): boolean {
  return new Date(`${ymd}T12:00:00${OFFSET}`).getUTCDay() === 0;
}

function addDays(ymd: string, days: number): string {
  return istanbulYmd(new Date(new Date(`${ymd}T12:00:00${OFFSET}`).getTime() + days * 86_400_000));
}

/** Saturday closes at 14:00 (defaultWorkingHours, which the demo agent also carries). */
function slotsOn(ymd: string, now: Date): string[] {
  if (isClosed(ymd)) return [];
  const saturday = new Date(`${ymd}T12:00:00${OFFSET}`).getUTCDay() === 6;
  return (saturday ? SLOT_TIMES.filter((t) => t < "14:00") : SLOT_TIMES).map((t) => new Date(`${ymd}T${t}:00${OFFSET}`))
    .filter((d) => d.getTime() > now.getTime() + 60 * 60 * 1000)
    .map((d) => d.toISOString());
}

const str = (args: Record<string, unknown>, key: string) => (typeof args[key] === "string" ? (args[key] as string).trim() : "");

/**
 * Same result shape as lib/booking/tools.ts, so the agent's prompt works
 * unchanged. Every result is a JSON string, as Vapi expects.
 */
export function demoToolResult(name: string, args: Record<string, unknown>, now: Date = new Date()): string {
  const speak = (iso: string) => speakInstantTr(new Date(iso), DEMO_TIME_ZONE, now);

  switch (name) {
    case "check_availability": {
      const date = str(args, "date");
      let slots: string[];
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        if (date < istanbulYmd(now)) {
          return JSON.stringify({ ok: false, spoken: "O tarih geçmişte kalmış. Önümüzdeki günler için bakayım mı?" });
        }
        if (isClosed(date)) {
          return JSON.stringify({
            ok: false,
            closed: true,
            spoken: `O gün kapalıyız. Açık olduğumuz saatler: ${speakHours(defaultWorkingHours())}. Başka bir güne bakmamı ister misiniz?`,
          });
        }
        slots = slotsOn(date, now).slice(0, 3);
      } else {
        slots = [];
        for (let i = 0; i < 7 && slots.length < 3; i++) {
          slots.push(...slotsOn(addDays(istanbulYmd(now), i), now).filter((_, j) => j % 2 === i % 2));
        }
        slots = slots.slice(0, 3);
      }
      if (!slots.length) {
        return JSON.stringify({ ok: false, spoken: "O gün boş yerimiz kalmamış. Başka bir güne bakmamı ister misiniz?" });
      }
      return JSON.stringify({ ok: true, slots, spoken: slots.map(speak), askPhone: false });
    }
    case "book_appointment": {
      const start = str(args, "start");
      const when = Number.isNaN(Date.parse(start)) ? null : speak(start);
      if (!when) return JSON.stringify({ ok: false, spoken: "Hangi saati istediğinizi tekrar alabilir miyim?" });
      return JSON.stringify({ ok: true, bookingUid: "demo", spoken: `Randevunuzu ${when} için oluşturdum.` });
    }
    case "find_appointment": {
      const date = str(args, "date");
      const at = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T14:00:00${OFFSET}`).toISOString() : null;
      if (!at) return JSON.stringify({ ok: false, spoken: "Randevunuzun hangi gün olduğunu söyler misiniz?" });
      return JSON.stringify({ ok: true, appointmentId: "demo-appointment", spoken: `${speak(at)} randevunuzu buldum.` });
    }
    case "cancel_appointment":
      return JSON.stringify({ ok: true, spoken: "Randevunuzu iptal ettim." });
    case "reschedule_appointment": {
      const start = str(args, "start");
      if (Number.isNaN(Date.parse(start))) return JSON.stringify({ ok: false, spoken: "Hangi saate almak istediğinizi söyler misiniz?" });
      return JSON.stringify({ ok: true, spoken: `Randevunuzu ${speak(start)} olarak güncelledim.` });
    }
    default:
      return JSON.stringify({ ok: false, error: `Unknown tool: ${name}` });
  }
}

/* ───────────────────────── recorded samples ───────────────────────── */

export interface SampleCall {
  id: string;
  title: { tr: string; en: string };
  /** Under public/; the list stays empty until real recordings are added. */
  src: string;
  transcript: { who: "agent" | "caller"; text: string }[];
}

/**
 * Recorded calls with the demo assistant, played when a live call isn't
 * possible (cap reached, demo off, no microphone). Add an entry only once its
 * mp3 is in public/demo-calls/ — the block hides itself while this is empty.
 */
export const SAMPLE_CALLS: SampleCall[] = [];

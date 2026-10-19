import { DAY_KEYS, type DayKey, type WorkingHours } from "@/lib/agents/hours";

/**
 * Turkish words for anything the voice agent reads out loud.
 *
 * Voices read "09:00" digit by digit ("sıfır dokuz sıfır sıfır") or as a
 * decimal, and the model copies whatever format its tool hands it. Giving it
 * ready-made words — "yarın, on altı Eylül Çarşamba, sabah dokuz" — removes the
 * guesswork. Panel text keeps digits (speakInstant in lib/calcom/client.ts);
 * this module is for speech only.
 */

const ONES = ["", "bir", "iki", "üç", "dört", "beş", "altı", "yedi", "sekiz", "dokuz"];
const TENS = ["", "on", "yirmi", "otuz", "kırk", "elli"];

/** 0–59 in words, which covers clock minutes and days of the month. */
export function numberWords(n: number): string {
  if (n === 0) return "sıfır";
  return [TENS[Math.floor(n / 10)], ONES[n % 10]].filter(Boolean).join(" ");
}

function dayPart(hour: number): string {
  if (hour < 5) return "gece";
  if (hour < 12) return "sabah";
  if (hour === 12) return "öğlen";
  if (hour < 18) return "öğleden sonra";
  if (hour < 22) return "akşam";
  return "gece";
}

/**
 * 9:00 → "sabah dokuz", 14:30 → "öğleden sonra iki buçuk",
 * 9:15 → "sabah dokuz on beş", 0:00 → "gece yarısı".
 */
export function speakClock(hour: number, minute: number): string {
  if (hour === 0 && minute === 0) return "gece yarısı";
  const base = `${dayPart(hour)} ${numberWords(hour % 12 || 12)}`;
  if (minute === 0) return base;
  if (minute === 30) return `${base} buçuk`;
  return `${base} ${numberWords(minute)}`;
}

/** "18:00" → "akşam altı"; anything unparseable is returned as-is. */
export function speakHHMM(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  return m ? speakClock(Number(m[1]), Number(m[2])) : hhmm;
}

const MONTHS = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

const WEEKDAY: Record<string, string> = {
  Mon: "Pazartesi", Tue: "Salı", Wed: "Çarşamba", Thu: "Perşembe", Fri: "Cuma", Sat: "Cumartesi", Sun: "Pazar",
};

function zoned(instant: Date, timeZone: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      weekday: "short",
      hour: "numeric",
      minute: "numeric",
    })
      .formatToParts(instant)
      .map((x) => [x.type, x.value]),
  );
  return {
    ymd: `${p.year}-${p.month}-${p.day}`,
    day: Number(p.day),
    month: Number(p.month),
    weekday: WEEKDAY[p.weekday] ?? "",
    hour: Number(p.hour),
    minute: Number(p.minute),
  };
}

/**
 * "bugün öğleden sonra iki", "yarın, on altı Eylül Çarşamba, sabah dokuz",
 * "on sekiz Eylül Cuma, sabah on buçuk" — in the clinic's time zone.
 */
export function speakInstantTr(instant: Date, timeZone: string, now: Date = new Date()): string {
  const t = zoned(instant, timeZone);
  const clock = speakClock(t.hour, t.minute);
  const today = zoned(now, timeZone).ymd;
  if (t.ymd === today) return `bugün ${clock}`;

  const date = `${numberWords(t.day)} ${MONTHS[t.month - 1]} ${t.weekday}`;
  const tomorrow = zoned(new Date(now.getTime() + 24 * 60 * 60 * 1000), timeZone).ymd;
  return t.ymd === tomorrow ? `yarın, ${date}, ${clock}` : `${date}, ${clock}`;
}

const DAY_TR: Record<DayKey, { name: string; from: string; to: string }> = {
  mon: { name: "Pazartesi", from: "Pazartesiden", to: "Pazartesiye" },
  tue: { name: "Salı", from: "Salıdan", to: "Salıya" },
  wed: { name: "Çarşamba", from: "Çarşambadan", to: "Çarşambaya" },
  thu: { name: "Perşembe", from: "Perşembeden", to: "Perşembeye" },
  fri: { name: "Cuma", from: "Cumadan", to: "Cumaya" },
  sat: { name: "Cumartesi", from: "Cumartesiden", to: "Cumartesiye" },
  sun: { name: "Pazar", from: "Pazardan", to: "Pazara" },
};

/**
 * "Pazartesiden Cumaya sabah dokuz ile akşam altı arası, Cumartesi sabah on
 * ile öğleden sonra iki arası" — consecutive days with the same hours merge.
 */
export function speakHours(hours: WorkingHours): string {
  const runs: { days: DayKey[]; open: string; close: string }[] = [];
  DAY_KEYS.forEach((key, i) => {
    const d = hours.days[key];
    if (d.closed) return;
    const last = runs[runs.length - 1];
    const adjacent = last && DAY_KEYS.indexOf(last.days[last.days.length - 1]) === i - 1;
    if (adjacent && last.open === d.open && last.close === d.close) last.days.push(key);
    else runs.push({ days: [key], open: d.open, close: d.close });
  });
  if (!runs.length) return "şu an kapalıyız";

  return runs
    .map(({ days, open, close }) => {
      const first = DAY_TR[days[0]];
      const end = DAY_TR[days[days.length - 1]];
      const label =
        days.length === 1 ? first.name : days.length === 2 ? `${first.name} ve ${end.name}` : `${first.from} ${end.to}`;
      return `${label} ${speakHHMM(open)} ile ${speakHHMM(close)} arası`;
    })
    .join(", ");
}

const BIG_TENS = ["", "on", "yirmi", "otuz", "kırk", "elli", "altmış", "yetmiş", "seksen", "doksan"];

/** 0–9999 in words: 24 → "yirmi dört", 100 → "yüz", 1250 → "bin iki yüz elli". Larger numbers stay digits. */
export function integerWords(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 9999) return String(n);
  if (n === 0) return "sıfır";
  const th = Math.floor(n / 1000);
  const h = Math.floor((n % 1000) / 100);
  const rest = n % 100;
  return [
    th === 0 ? "" : th === 1 ? "bin" : `${ONES[th]} bin`,
    h === 0 ? "" : h === 1 ? "yüz" : `${ONES[h]} yüz`,
    BIG_TENS[Math.floor(rest / 10)],
    ONES[rest % 10],
  ]
    .filter(Boolean)
    .join(" ");
}

/** The ordinal form of a number word: "iki" → "ikinci", "dört" → "dördüncü", "on" → "onuncu". */
const ORDINAL_LAST: Record<string, string> = {
  bir: "birinci", iki: "ikinci", üç: "üçüncü", dört: "dördüncü", beş: "beşinci",
  altı: "altıncı", yedi: "yedinci", sekiz: "sekizinci", dokuz: "dokuzuncu",
  on: "onuncu", yirmi: "yirminci", otuz: "otuzuncu", kırk: "kırkıncı", elli: "ellinci",
  altmış: "altmışıncı", yetmiş: "yetmişinci", seksen: "sekseninci", doksan: "doksanıncı",
  yüz: "yüzüncü", bin: "bininci",
};

export function ordinalWords(n: number): string {
  if (n === 0) return "zemin";
  const words = integerWords(n).split(" ");
  const last = ORDINAL_LAST[words[words.length - 1]];
  if (!last) return `${n}.`;
  words[words.length - 1] = last;
  return words.join(" ");
}

// Not a letter on either side — \b only knows ASCII, and these sit next to "ğ", "ı"…
const ADDRESS_WORDS: [RegExp, string][] = [
  [/(?<!\p{L})(?:mah|mh)\.?(?!\p{L})/giu, "Mahallesi"],
  [/(?<!\p{L})(?:cad|cd)\.?(?!\p{L})/giu, "Caddesi"],
  [/(?<!\p{L})(?:sok|sk)\.?(?!\p{L})/giu, "Sokak"],
  [/(?<!\p{L})(?:bul|blv)\.?(?!\p{L})/giu, "Bulvarı"],
  [/(?<!\p{L})apt\.?(?!\p{L})/giu, "Apartmanı"],
];

/**
 * "Caferağa Mah. Moda Cad. No: 24 Kat: 2, Kadıköy / İstanbul" →
 * "Caferağa Mahallesi Moda Caddesi numara yirmi dört, ikinci kat, Kadıköy, İstanbul".
 * The voice otherwise reads "No" as English "no" and "Kat: 2" as two words.
 */
export function speakAddressTr(address: string): string {
  let s = address;
  for (const [re, word] of ADDRESS_WORDS) s = s.replace(re, word);
  s = s
    .replace(/(?<!\p{L})kat\s*[:.]?\s*(\d+)/giu, (_, d: string) => `, ${ordinalWords(Number(d))} kat`)
    .replace(/(?<!\p{L})(?:no|numara)\s*[:.]?\s*(\d+)/giu, (_, d: string) => `numara ${d}`)
    .replace(/(?<!\p{L})(?:d|daire)\s*[:.]\s*(\d+)/giu, (_, d: string) => `, daire ${d}`)
    .replace(/(\d)\s*\/\s*(\d)/g, "$1 bölü $2")
    .replace(/\s*\/\s*/g, ", ")
    .replace(/\d+/g, (d) => integerWords(Number(d)))
    .replace(/\s*:\s*/g, " ")
    .replace(/\s+([,.])/g, "$1")
    .replace(/,(\s*,)+/g, ",")
    .replace(/\s{2,}/g, " ")
    .replace(/^[,\s]+/, "")
    .trim();
  return s;
}

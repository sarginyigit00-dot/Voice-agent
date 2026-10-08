/**
 * Demo data — what makes the Randevox cockpit feel alive with zero API keys. Labels
 * are bilingual ({ tr, en }); the UI resolves them to the active language.
 * Proper nouns and free text (caller names, numbers) stay as-is. Replace with
 * real Vapi/Twilio/LLM queries once setup wires your integrations.
 */
import type { L } from "@/lib/i18n/config";
import { ACTION_IDS, ACTION_LABEL, DEFAULT_ACTIONS_ON, type ActionId } from "@/lib/actions/registry";
import { defaultWorkingHours, type WorkingHours } from "@/lib/agents/hours";

/* ════════════════════════════ KPI SUMMARY ════════════════════════════ */
export interface DKpi {
  label: L;
  value: string;
  delta?: number;
  icon?: string;
  hint?: L;
}

const vsYday: L = { tr: "düne göre", en: "vs yesterday" };

export const kpis: DKpi[] = [
  { label: { tr: "Karşılanan arama", en: "Calls handled" }, value: "342", delta: 14.2, icon: "phone-incoming", hint: vsYday },
  { label: { tr: "Ort. süre", en: "Avg duration" }, value: "2:48", delta: -6.0, icon: "timer", hint: vsYday },
  { label: { tr: "Randevu / nitelikli", en: "Booked / qualified" }, value: "118", delta: 9.4, icon: "calendar-check", hint: vsYday },
  { label: { tr: "Kullanılan dakika", en: "Minutes used" }, value: "1,612", delta: 11.0, icon: "gauge", hint: vsYday },
];

/* ════════════════════════════ OUTCOMES ════════════════════════════ */
export type Outcome = "booked" | "transferred" | "voicemail" | "resolved" | "missed";
export type Sentiment = "positive" | "neutral" | "negative";

export const OUTCOME_LABEL: Record<Outcome, L> = {
  booked: { tr: "Randevu", en: "Booked" },
  transferred: { tr: "Transfer", en: "Transferred" },
  voicemail: { tr: "Sesli mesaj", en: "Voicemail" },
  resolved: { tr: "Çözüldü", en: "Resolved" },
  missed: { tr: "Kaçırıldı", en: "Missed" },
};

/** CSS var per outcome — drives the outcome pills + donut. */
export const OUTCOME_TINT: Record<Outcome, string> = {
  booked: "var(--color-booked)",
  resolved: "var(--color-violet)",
  transferred: "var(--color-transfer)",
  voicemail: "var(--color-voicemail)",
  missed: "var(--color-missed)",
};

export const SENTIMENT_LABEL: Record<Sentiment, L> = {
  positive: { tr: "Olumlu", en: "Positive" },
  neutral: { tr: "Nötr", en: "Neutral" },
  negative: { tr: "Olumsuz", en: "Negative" },
};

/** Outcomes breakdown for the donut. */
export const outcomes: { key: Outcome; value: number }[] = [
  { key: "booked", value: 118 },
  { key: "resolved", value: 96 },
  { key: "transferred", value: 64 },
  { key: "voicemail", value: 41 },
  { key: "missed", value: 23 },
];

/* ════════════════════════════ TRANSCRIPTS ════════════════════════════ */
export interface Turn {
  who: "agent" | "caller";
  /** seconds offset into the call (for the scrubber) */
  at: number;
  text: L;
}

/* ════════════════════════════ CALL LOG ════════════════════════════ */
export interface CallRow {
  id: string;
  caller: string;
  number: string;
  agentId: string;
  time: string;        // HH:MM
  duration: string;    // M:SS
  durationSec: number;
  outcome: Outcome;
  sentiment: Sentiment;
  /** Vapi's recording URL. Always null for demo rows — there is no real audio behind them. */
  recordingUrl: string | null;
  /** waveform amplitude samples (0..1) for the mini-viz */
  wave: number[];
  summary: L;
  actions: L[];
  transcript: Turn[];
}

const wA = [0.4, 0.7, 0.5, 0.9, 0.6, 0.3, 0.8, 0.5, 0.7, 0.4, 0.6, 0.9, 0.5];
const wB = [0.6, 0.4, 0.8, 0.5, 0.3, 0.7, 0.9, 0.4, 0.6, 0.5, 0.8, 0.3, 0.7];
const wC = [0.3, 0.6, 0.4, 0.7, 0.5, 0.9, 0.6, 0.8, 0.4, 0.7, 0.5, 0.6, 0.3];

export const CALLS: CallRow[] = [
  {
    id: "c1", caller: "Ayşe Yıldırım", number: "+90 532 555 0241", agentId: "ag1",
    time: "14:32", duration: "3:12", durationSec: 192, outcome: "booked", sentiment: "positive", wave: wA, recordingUrl: null,
    summary: { tr: "Salı 10:00 için implant konsültasyonu randevusu aldı, telefonu doğrulandı.", en: "Booked an implant consultation for Tue 10:00, phone number confirmed." },
    actions: [
      { tr: "Takvime randevu eklendi — Sal 10:00", en: "Calendar event created — Tue 10:00" },
      { tr: "Onay SMS'i gönderildi", en: "Confirmation SMS sent" },
    ],
    transcript: [
      { who: "agent", at: 0, text: { tr: "Estetenova Diş Kliniği, ben Randevox. Size nasıl yardımcı olabilirim?", en: "Thanks for calling Estetenova Dental, this is Randevox. How can I help?" } },
      { who: "caller", at: 4, text: { tr: "Merhaba, diş implantı için bir görüşme almak istiyorum.", en: "Hi, I'd like to book a consultation for a dental implant." } },
      { who: "agent", at: 9, text: { tr: "Memnuniyetle. Bu hafta salı sabahı 10:00 uygun mu?", en: "Happy to help. Would Tuesday morning at 10:00 work for you?" } },
      { who: "caller", at: 15, text: { tr: "Evet, salı 10 harika.", en: "Yes, Tuesday at 10 is great." } },
      { who: "agent", at: 19, text: { tr: "Harika — adınızı ve telefon numaranızı teyit edebilir miyim?", en: "Perfect — can I confirm your name and phone number?" } },
      { who: "caller", at: 23, text: { tr: "Ayşe Yıldırım, 0532 555 02 41.", en: "Ayşe Yıldırım, 0532 555 02 41." } },
      { who: "agent", at: 29, text: { tr: "Randevunuzu Salı 10:00'a aldım ve onay mesajı gönderiyorum. Başka bir şey var mı?", en: "I've booked Tuesday 10:00 and I'm sending a confirmation text. Anything else?" } },
      { who: "caller", at: 37, text: { tr: "Hayır, teşekkürler!", en: "No, that's all, thank you!" } },
    ],
  },
  {
    id: "c2", caller: "Emre Doğan", number: "+90 533 555 0316", agentId: "ag2",
    time: "14:18", duration: "1:54", durationSec: 114, outcome: "resolved", sentiment: "positive", wave: wB, recordingUrl: null,
    summary: { tr: "Sıcak aday — 6 diş için gülüş tasarımı istiyor, bu ay başlamak istiyor. Hasta danışmanına iletildi.", en: "Hot lead — wants smile design for 6 teeth, wants to start this month. Forwarded to the patient coordinator." },
    actions: [
      { tr: "Aday sıcak olarak puanlandı (87/100)", en: "Lead scored hot (87/100)" },
      { tr: "Hasta danışmanına bildirim gitti", en: "Patient coordinator notified" },
    ],
    transcript: [
      { who: "agent", at: 0, text: { tr: "Estetenova Diş Kliniği, ben dijital asistanınız. Hangi konuda arıyorsunuz?", en: "Estetenova Dental, I'm your digital assistant. What brings you in today?" } },
      { who: "caller", at: 5, text: { tr: "Ön dişlerim için gülüş tasarımına bakıyorum, süreci merak ediyorum.", en: "I'm looking at smile design for my front teeth, curious about the process." } },
      { who: "agent", at: 11, text: { tr: "Tabii. Kaç diş için düşünüyorsunuz?", en: "Of course. Roughly how many teeth are you thinking about?" } },
      { who: "caller", at: 16, text: { tr: "Üst çenede altı diş.", en: "Six teeth in the upper jaw." } },
      { who: "agent", at: 21, text: { tr: "Anladım. Ne zaman başlamayı düşünüyorsunuz?", en: "Got it. When are you hoping to start?" } },
      { who: "caller", at: 27, text: { tr: "Bu ay içinde başlamak isterim.", en: "I'd like to start this month." } },
      { who: "agent", at: 33, text: { tr: "Mükemmel — sizi hasta danışmanımıza bağlıyorum, ayrıntıları konuşalım.", en: "Perfect — I'll connect you with our patient coordinator to go through the details." } },
    ],
  },
  {
    id: "c3", caller: "Unknown", number: "+90 216 555 0187", agentId: "ag1",
    time: "13:55", duration: "0:48", durationSec: 48, outcome: "transferred", sentiment: "neutral", wave: wC, recordingUrl: null,
    summary: { tr: "Tedavi sonrası şikâyet — ajan resepsiyona canlı transfer etti.", en: "Post-treatment complaint — agent warm-transferred to the front desk." },
    actions: [{ tr: "Resepsiyona transfer", en: "Transferred to front desk" }],
    transcript: [
      { who: "agent", at: 0, text: { tr: "Merhaba, ben Randevox. Nasıl yardımcı olabilirim?", en: "Hi, this is Randevox. How can I help?" } },
      { who: "caller", at: 4, text: { tr: "Geçen hafta implant taktırdım, dikiş yerim ağrıyor.", en: "I had an implant placed last week and the stitch area hurts." } },
      { who: "agent", at: 8, text: { tr: "Geçmiş olsun. Tıbbi bir konu olduğu için sizi hemen resepsiyona bağlıyorum.", en: "I'm sorry to hear that. As it's a medical matter I'm connecting you to the front desk right away." } },
    ],
  },
  {
    id: "c4", caller: "Hakan Aksoy", number: "+90 535 555 0472", agentId: "ag3",
    time: "13:40", duration: "2:21", durationSec: 141, outcome: "booked", sentiment: "positive", wave: wA, recordingUrl: null,
    summary: { tr: "Diş kontrolü için Perşembe 15:30 randevusu aldı.", en: "Booked a dental check-up for Thursday 15:30." },
    actions: [
      { tr: "Randevu eklendi — Per 15:30", en: "Appointment created — Thu 15:30" },
      { tr: "Hatırlatma 24s öncesine ayarlandı", en: "Reminder set for 24h prior" },
    ],
    transcript: [
      { who: "agent", at: 0, text: { tr: "Estetenova Diş Kliniği, ben Randevox. Size nasıl yardımcı olabilirim?", en: "Estetenova Dental, this is Randevox. How can I help you today?" } },
      { who: "caller", at: 5, text: { tr: "Rutin bir kontrol için randevu almak istiyorum.", en: "I'd like to schedule a routine check-up." } },
      { who: "agent", at: 10, text: { tr: "Tabii. Perşembe öğleden sonra 15:30 sizin için uygun mu?", en: "Sure. Would Thursday afternoon at 15:30 work?" } },
      { who: "caller", at: 16, text: { tr: "Perşembe gayet iyi.", en: "Thursday works fine." } },
      { who: "agent", at: 20, text: { tr: "Sizi Perşembe 15:30'a aldım ve bir gün önce hatırlatma göndereceğim.", en: "I've booked you for Thursday 15:30 and I'll send a reminder the day before." } },
    ],
  },
  {
    id: "c5", caller: "Kaan Erdem", number: "+90 542 555 0523", agentId: "ag2",
    time: "13:12", duration: "0:32", durationSec: 32, outcome: "voicemail", sentiment: "neutral", wave: wB, recordingUrl: null,
    summary: { tr: "Arayan mesaj bıraktı — geri arama talep etti.", en: "Caller left a message — requested a callback." },
    actions: [{ tr: "Geri arama görevi oluşturuldu", en: "Callback task created" }],
    transcript: [
      { who: "agent", at: 0, text: { tr: "Şu an müsait değiliz. Mesajınızı bırakın, en kısa sürede dönelim.", en: "We can't take your call right now. Leave a message and we'll get back to you." } },
      { who: "caller", at: 6, text: { tr: "Merhaba, fiyatlandırma hakkında geri dönmenizi istiyorum.", en: "Hi, I'd like a callback about pricing." } },
    ],
  },
  {
    id: "c6", caller: "Merve Çetin", number: "+90 536 555 0619", agentId: "ag3",
    time: "12:48", duration: "4:05", durationSec: 245, outcome: "resolved", sentiment: "positive", wave: wC, recordingUrl: null,
    summary: { tr: "Randevu erteleme talebini ajan kendi başına çözdü.", en: "Agent resolved an appointment-reschedule request end to end." },
    actions: [
      { tr: "Randevu Cuma 11:00'e taşındı", en: "Appointment moved to Fri 11:00" },
      { tr: "Hasta bilgilendirildi", en: "Patient notified" },
    ],
    transcript: [
      { who: "agent", at: 0, text: { tr: "Estetenova Diş Kliniği, ben Randevox. Nasıl yardımcı olabilirim?", en: "Estetenova Dental, this is Randevox. How can I help?" } },
      { who: "caller", at: 5, text: { tr: "Perşembeki randevumu ertelemem gerekiyor.", en: "I need to move my Thursday appointment." } },
      { who: "agent", at: 9, text: { tr: "Tabii, adınızı alabilir miyim?", en: "Sure, can I get your name?" } },
      { who: "caller", at: 14, text: { tr: "Merve Çetin.", en: "Merve Çetin." } },
      { who: "agent", at: 19, text: { tr: "Teşekkürler. Randevunuzu Cuma 11:00'e aldım, onay mesajı geliyor.", en: "Thank you. I've moved you to Friday 11:00 and a confirmation is on its way." } },
    ],
  },
  {
    id: "c7", caller: "Onur Bilgin", number: "+90 505 555 0744", agentId: "ag1",
    time: "12:20", duration: "1:38", durationSec: 98, outcome: "missed", sentiment: "negative", wave: wA, recordingUrl: null,
    summary: { tr: "Arayan beklemede kaldı ve kapattı — geri arama için işaretlendi.", en: "Caller dropped while on hold — flagged for callback." },
    actions: [{ tr: "Acil geri arama olarak işaretlendi", en: "Flagged as priority callback" }],
    transcript: [
      { who: "agent", at: 0, text: { tr: "Merhaba, ben Randevox. Nasıl yardımcı olabilirim?", en: "Hi, this is Randevox. How can I help?" } },
      { who: "caller", at: 4, text: { tr: "Acil bir konu için arıyorum…", en: "I'm calling about an urgent issue…" } },
    ],
  },
  {
    id: "c8", caller: "Ceren Aydın", number: "+90 545 555 0852", agentId: "ag2",
    time: "11:54", duration: "2:57", durationSec: 177, outcome: "booked", sentiment: "positive", wave: wB, recordingUrl: null,
    summary: { tr: "Diş beyazlatma randevusu aldı — Cumartesi 11:00.", en: "Booked a teeth-whitening appointment — Saturday 11:00." },
    actions: [
      { tr: "Beyazlatma planlandı — Cmt 11:00", en: "Whitening scheduled — Sat 11:00" },
      { tr: "Konum bağlantısı gönderildi", en: "Location link sent" },
    ],
    transcript: [
      { who: "agent", at: 0, text: { tr: "Estetenova Diş Kliniği, ben Randevox. Size nasıl yardımcı olabilirim?", en: "Estetenova Dental, this is Randevox. How can I help?" } },
      { who: "caller", at: 5, text: { tr: "Diş beyazlatma için randevu almak istiyorum.", en: "I'd like to book a teeth-whitening session." } },
      { who: "agent", at: 11, text: { tr: "Tabii. Cumartesi 11:00 sizin için uygun mu?", en: "Of course. Would Saturday at 11:00 suit you?" } },
      { who: "caller", at: 17, text: { tr: "Cumartesi mükemmel.", en: "Saturday is perfect." } },
      { who: "agent", at: 21, text: { tr: "Beyazlatmayı Cumartesi 11:00'a aldım ve konum bağlantısını gönderiyorum.", en: "I've scheduled the whitening for Saturday 11:00 and I'm texting you the location." } },
    ],
  },
];

/* ════════════════════════════ LIVE CALLS ════════════════════════════ */
export interface LiveCall {
  id: string;
  caller: string;
  number: string;
  agentId: string;
  elapsed: string;     // M:SS so far
  stage: L;            // what the agent is doing right now
}

export const LIVE_CALLS: LiveCall[] = [
  { id: "l1", caller: "Incoming", number: "+90 532 555 0907", agentId: "ag1", elapsed: "0:42", stage: { tr: "Uygunluk kontrol ediliyor", en: "Checking availability" } },
  { id: "l2", caller: "Incoming", number: "+90 507 555 0163", agentId: "ag2", elapsed: "1:18", stage: { tr: "Aday nitelendiriliyor", en: "Qualifying the lead" } },
];

/* ════════════════════════════ AGENTS ════════════════════════════ */
export interface Agent {
  id: string;
  name: string;
  voice: string;
  purpose: L;
  callsToday: number;
  active: boolean;
  greeting: L;
  /** Which of the 5 shared actions (lib/actions/registry.ts) this agent runs after a call. */
  actionIds: ActionId[];
  /**
   * The clinic's own instructions — services, prices, FAQ, escalation rules.
   * Single-language on purpose: the clinic writes it once, in its own words,
   * and lib/agents/prompt.ts wraps it into the full instruction block.
   */
  systemPrompt: string;
  /** When the phone line books. Enforced in lib/booking/tools.ts. */
  workingHours: WorkingHours;
  /**
   * The Vapi assistant this agent is provisioned as (lib/vapi/sync.ts). Only
   * the server writes it; demo agents never have one.
   */
  vapiAssistantId?: string | null;
}

export const AGENTS: Agent[] = [
  {
    id: "ag1", name: "Ön Büro", voice: "Defne · warm female", active: true, callsToday: 142,
    purpose: { tr: "Gelen aramaları karşılar, randevu alır, yönlendirir.", en: "Greets inbound calls, books appointments and routes." },
    greeting: { tr: "Estetenova Diş Kliniği'ne hoş geldiniz, ben Randevox. Size nasıl yardımcı olabilirim?", en: "Thanks for calling Estetenova Dental, this is Randevox. How can I help?" },
    actionIds: ["book", "transfer", "sms"],
    systemPrompt:
      "Estetenova Diş Kliniği'ne gelen aramaları karşılıyorsun.\n\nHizmetler: implant konsültasyonu (ücretsiz, 30 dk), diş implantı, zirkonyum kaplama, gülüş tasarımı, ortodonti (şeffaf plak), diş beyazlatma, genel muayene ve dolgu.\nFiyat sorulursa: konsültasyon ücretsizdir; tedavi fiyatı çene yapısına ve gereken işleme göre değişir, kesin fiyat ancak hekim muayenesinden sonra verilir. Telefonda rakam verme.\nAdres: Nispetiye Cad. No:12, Etiler, İstanbul.\n\nTıbbi soru sorulursa (ilaç, iyileşme süreci, komplikasyon) cevaplama — hekime aktar.",
    workingHours: defaultWorkingHours(),
  },
  {
    id: "ag2", name: "Hasta Danışmanı", voice: "Kerem · confident male", active: true, callsToday: 98,
    purpose: { tr: "İmplant ve estetik adaylarını nitelendirir, hasta danışmanına iletir.", en: "Qualifies implant and aesthetic leads and forwards them to the patient coordinator." },
    greeting: { tr: "Estetenova Diş Kliniği'ne hoş geldiniz! Hangi konuda yardımcı olabilirim?", en: "Welcome to Estetenova Dental! What can I help you with today?" },
    actionIds: ["qualify", "crm"],
    systemPrompt:
      "Gelen adayın hangi tedaviyi (implant, gülüş tasarımı, ortodonti vb.) istediğini, kaç diş için düşündüğünü ve ne zaman başlamak istediğini öğren.\nBu üçü netleşmeden hasta danışmanına aktarma.\nFiyat pazarlığına girme; indirim sorulursa hasta danışmanının dönüş yapacağını söyle.",
    workingHours: defaultWorkingHours(),
  },
  {
    id: "ag3", name: "Randevu Masası", voice: "Deniz · calm neutral", active: true, callsToday: 67,
    purpose: { tr: "Hasta randevuları ve rutin talepleri yönetir.", en: "Handles patient bookings and routine requests." },
    greeting: { tr: "Estetenova Diş Kliniği, ben Randevox. Size nasıl yardımcı olabilirim?", en: "Estetenova Dental, this is Randevox. How can I help you today?" },
    actionIds: ["book", "sms"],
    systemPrompt:
      "Estetenova Diş Kliniği hasta karşılama hattısın.\n\nRandevu alırken hastanın adını ve telefonunu mutlaka teyit et.\nİlk kez arayan hastalara konsültasyonun 30 dakika sürdüğünü ve ücretsiz olduğunu söyle.\nRandevu iptali veya erteleme talebi gelirse, hastayı resepsiyona aktar — bunu telefonda sen yapma.",
    workingHours: defaultWorkingHours(),
  },
  {
    id: "ag4", name: "Mesai Dışı", voice: "Ada · soft female", active: false, callsToday: 35,
    purpose: { tr: "Mesai dışı mesaj alır ve acil olanları yönlendirir.", en: "Takes after-hours messages and escalates urgent ones." },
    greeting: { tr: "Şu an kapalıyız. Mesajınızı bırakın, sabah ilk iş dönüş yapalım.", en: "We're closed right now. Leave a message and we'll call back first thing." },
    actionIds: ["sms", "transfer"],
    systemPrompt:
      "Klinik kapalıyken arayanları karşılıyorsun. Randevu ALMA — bu hat randevu veremez.\nHastanın adını, telefonunu ve konusunu al, ertesi gün ilk iş dönüleceğini söyle.\nAcil bir durum tarif edilirse (durmayan kanama, yüzde şişlik, şiddetli diş ağrısı, kırık diş, ateş) hemen nöbetçi hekime aktar.",
    // The mirror image of the daytime line: open exactly when the clinic isn't.
    workingHours: {
      timeZone: "Europe/Istanbul",
      days: {
        mon: { open: "18:00", close: "23:59", closed: false },
        tue: { open: "18:00", close: "23:59", closed: false },
        wed: { open: "18:00", close: "23:59", closed: false },
        thu: { open: "18:00", close: "23:59", closed: false },
        fri: { open: "18:00", close: "23:59", closed: false },
        sat: { open: "14:00", close: "23:59", closed: false },
        sun: { open: "00:00", close: "23:59", closed: false },
      },
    },
  },
];

/* The available voices for the agent-builder preview. */
export const VOICES = ["Orion · warm male", "Lyra · clear female"];

/* The action toggles in the agent-builder preview — built from the shared registry. */
export const BUILDER_ACTIONS: { id: ActionId; label: L; on: boolean }[] = ACTION_IDS.map((id) => ({
  id,
  label: ACTION_LABEL[id],
  on: DEFAULT_ACTIONS_ON[id],
}));

/* ════════════════════════════ CALL-VOLUME CHART ════════════════════════════ */
/** Calls per hour across a business day — drives the area chart. */
export const callVolume: { label: string; value: number }[] = [
  { label: "8a", value: 8 }, { label: "9a", value: 18 }, { label: "10a", value: 31 },
  { label: "11a", value: 42 }, { label: "12p", value: 38 }, { label: "1p", value: 29 },
  { label: "2p", value: 47 }, { label: "3p", value: 51 }, { label: "4p", value: 44 },
  { label: "5p", value: 33 }, { label: "6p", value: 19 }, { label: "7p", value: 11 },
];

export const volumeMeta = {
  title: { tr: "Saatlik arama hacmi", en: "Call volume by hour" } as L,
  subtitle: { tr: "Bugün", en: "Today" } as L,
  delta: "+14.2%",
};

/* ════════════════════════════ MINUTES METER ════════════════════════════ */
export const minutes = {
  label: { tr: "Bu ay kullanılan dakika", en: "Minutes used this month" } as L,
  used: 1612,
  cap: 2000,
  sub: { tr: "2.000 dakikalık paketin %81'i", en: "81% of your 2,000-minute plan" } as L,
};

/* ════════════════════════════ MARKETING ════════════════════════════ */
/** Trusted-by SVG wordmarks (text-only — no brand logos). */
export const MARKETING_LOGOS = ["Brightline", "Cedar Health", "Harborline", "Northwind", "Parable", "Formwork", "Lumen", "Cooper & Co"];

/** Marquee strip of recent call outcomes. */
export const TICKER: { symbol: string; text: L; tone: Outcome }[] = [
  { symbol: "BOOKED", text: { tr: "İmplant konsültasyonu · Per 15:30", en: "Implant consultation · Thu 15:30" }, tone: "booked" },
  { symbol: "QUALIFIED", text: { tr: "Gülüş tasarımı adayı · danışmana iletildi", en: "Smile design lead · sent to coordinator" }, tone: "resolved" },
  { symbol: "TRANSFERRED", text: { tr: "Tedavi sonrası şikâyet · resepsiyon", en: "Post-treatment complaint · front desk" }, tone: "transferred" },
  { symbol: "BOOKED", text: { tr: "Diş beyazlatma · Cmt 11:00", en: "Teeth whitening · Sat 11:00" }, tone: "booked" },
  { symbol: "RESOLVED", text: { tr: "Randevu ertelendi", en: "Appointment rescheduled" }, tone: "resolved" },
  { symbol: "BOOKED", text: { tr: "Diş taşı temizliği · Sal 10:00", en: "Dental cleaning · Tue 10:00" }, tone: "booked" },
];

/** The streaming-transcript script for the interactive landing demo. */
export const DEMO_SCRIPT: Turn[] = [
  { who: "agent", at: 0, text: { tr: "Estetenova Diş Kliniği, ben Randevox. Size nasıl yardımcı olabilirim?", en: "Thanks for calling Estetenova Dental, this is Randevox. How can I help?" } },
  { who: "caller", at: 3, text: { tr: "Merhaba, bir randevu almak istiyorum.", en: "Hi, I'd like to book an appointment." } },
  { who: "agent", at: 6, text: { tr: "Memnuniyetle. Salı sabahı 10:00 uygun mu?", en: "Happy to help. Would Tuesday morning at 10:00 work?" } },
  { who: "caller", at: 10, text: { tr: "Evet, salı harika.", en: "Yes, Tuesday is great." } },
  { who: "agent", at: 13, text: { tr: "Sizi Salı 10:00'a aldım ve onay mesajı gönderiyorum.", en: "I've booked you for Tuesday 10:00 and I'm sending a confirmation text." } },
];

export interface UseCase {
  icon: string;
  title: L;
  body: L;
}

export const USE_CASES: UseCase[] = [
  { icon: "stethoscope", title: { tr: "Diş klinikleri", en: "Dental clinics" }, body: { tr: "İmplant ve estetik görüşmelerini randevuya çevir, yeniden planla, hatırlat.", en: "Turn implant and aesthetic enquiries into bookings, reschedule and remind." } },
  { icon: "star", title: { tr: "Implant ve gülüş tasarımı", en: "Implants and smile design" }, body: { tr: "Yüksek değerli adayları nitelendir, konsültasyona yönlendir.", en: "Qualify high-value leads and route them to a consultation." } },
];

export interface CompareRow {
  label: L;
  callCenter: boolean | L;
  voicemail: boolean | L;
  vox: boolean | L;
}

export const COMPARE: CompareRow[] = [
  { label: { tr: "7/24 her aramayı karşılar", en: "Answers every call 24/7" }, callCenter: { tr: "Sınırlı", en: "Limited" }, voicemail: false, vox: true },
  { label: { tr: "Randevu alır", en: "Books appointments" }, callCenter: true, voicemail: false, vox: true },
  { label: { tr: "Adayları nitelendirir", en: "Qualifies leads" }, callCenter: { tr: "Değişken", en: "Inconsistent" }, voicemail: false, vox: true },
  { label: { tr: "Anında ölçeklenir", en: "Scales instantly" }, callCenter: false, voicemail: true, vox: true },
  { label: { tr: "Dakika başı maliyet", en: "Cost per minute" }, callCenter: { tr: "$$$", en: "$$$" }, voicemail: { tr: "$", en: "$" }, vox: { tr: "¢", en: "¢" } },
  { label: { tr: "Transkript & analitik", en: "Transcripts & analytics" }, callCenter: { tr: "Kısmen", en: "Partial" }, voicemail: false, vox: true },
];

export interface Testimonial {
  quote: L;
  name: string;
  role: L;
  initials: string;
}

export const TESTIMONIALS: Testimonial[] = [
  { quote: { tr: "Randevox geceleri gelen aramaların hepsini karşılıyor. İlk ay randevularımız %34 arttı.", en: "Randevox answers every after-hours call. Bookings jumped 34% in the first month." }, name: "Dr. Elif Şahin", role: { tr: "Cedar Diş Kliniği", en: "Cedar Dental" }, initials: "EŞ" },
  { quote: { tr: "Artık hiçbir sıcak aday sesli mesaja düşmüyor. Satış ekibim sadece nitelikli aramaları alıyor.", en: "No hot lead drops to voicemail anymore. My sales team only gets qualified calls." }, name: "Mert Aydın", role: { tr: "Satış Direktörü, Parable", en: "Head of Sales, Parable" }, initials: "MA" },
  { quote: { tr: "Sesi o kadar doğal ki müşterilerimiz bot olduğunu fark etmiyor. Kurulum 10 dakika sürdü.", en: "The voice is so natural our clients don't realize it's a bot. Setup took 10 minutes." }, name: "Pınar Koç", role: { tr: "Kurucu, Harborline Emlak", en: "Founder, Harborline Realty" }, initials: "PK" },
  { quote: { tr: "Bir resepsiyonist işe almak yerine Randevox'u açtık. Üç kişilik bir ekibin işini yapıyor.", en: "Instead of hiring a receptionist we switched on Randevox. It does the work of a three-person desk." }, name: "Ozan Kılıç", role: { tr: "Operasyon, Brightline", en: "Ops, Brightline" }, initials: "OK" },
  { quote: { tr: "Her aramanın transkripti ve özeti CRM'imize düşüyor. Manuel not almak tarih oldu.", en: "Every call's transcript and summary lands in our CRM. Manual notes are history." }, name: "Deniz Çelik", role: { tr: "Kurucu, Formwork", en: "Founder, Formwork" }, initials: "DÇ" },
];

/**
 * Public-facing figures. These are capability claims the product can actually
 * keep — never invented traction ("1.4M calls", "4.9/5") that a prospect could
 * ask us to back up.
 */
export const METRICS: { value: string; label: L }[] = [
  { value: "7/24", label: { tr: "kesintisiz açık hat", en: "line that always answers" } },
  { value: "İlk çalışta", label: { tr: "telefonu açar", en: "answers on the first ring" } },
  { value: "0", label: { tr: "sesli mesaja düşen arama", en: "calls dropped to voicemail" } },
];

export const HOW_STEPS: { icon: string; title: L; body: L }[] = [
  { icon: "phone", title: { tr: "Bir numara al", en: "Get a number" }, body: { tr: "Saniyeler içinde bir Randevox numarası al veya mevcut numaranı taşı.", en: "Grab a Randevox number in seconds, or port your existing line." } },
  { icon: "bot", title: { tr: "Ajanını tarif et", en: "Describe the agent" }, body: { tr: "Düz cümlelerle ne yapacağını söyle — sesini, karşılamasını ve eylemlerini seç.", en: "Tell it what to do in plain language — pick its voice, greeting and actions." } },
  { icon: "phone-incoming", title: { tr: "Aramaları açsın", en: "It answers calls" }, body: { tr: "Randevox 7/24 açar, randevu alır, nitelendirir, yönlendirir — sen uyurken bile.", en: "Randevox answers 24/7 — booking, qualifying and routing, even while you sleep." } },
];

/* ════════════════════════════ APPOINTMENTS ════════════════════════════ */

/**
 * Demo rows for /randevular when Supabase isn't connected. Generated relative
 * to "now" so the page always has a believable mix of upcoming and past —
 * hardcoded dates would drift into the past and make the page look broken.
 *
 * Built by a function, not a const, because a module-level `new Date()` would
 * differ between the server render and the client one and trip hydration. The
 * page calls this after mount.
 */
export interface DemoAppointment {
  id: string;
  callId: string;
  bookingUid: string;
  startsAt: string;
  attendeeName: string;
  attendeeEmail: string | null;
  attendeePhone: string | null;
  agentId: string | null;
  source: "in-call" | "post-call";
  status: "booked" | "cancelled";
  service?: string | null;
  doctor?: string | null;
  cancelledAt: string | null;
  createdAt: string;
}

export function demoAppointments(): DemoAppointment[] {
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;
  const now = Date.now();

  const at = (offsetDays: number, h: number) => {
    const d = new Date(now + offsetDays * day);
    d.setHours(h, 0, 0, 0);
    return d.toISOString();
  };

  const rows: Omit<DemoAppointment, "id" | "createdAt">[] = [
    { callId: "call-d1", bookingUid: "bk_9fa21", startsAt: at(0, 15), attendeeName: "Elif Demir", attendeeEmail: "elif.demir@example.com", attendeePhone: "+90 532 555 0182", agentId: "ag1", source: "in-call", status: "booked", service: "Diş taşı temizliği", doctor: "Dt. Ayşe Kaya", cancelledAt: null },
    { callId: "call-d2", bookingUid: "bk_7cd40", startsAt: at(1, 10), attendeeName: "Mert Kaya", attendeeEmail: null, attendeePhone: "+90 555 555 0114", agentId: "ag3", source: "in-call", status: "booked", cancelledAt: null },
    { callId: "call-d3", bookingUid: "bk_1ba88", startsAt: at(1, 16), attendeeName: "Zeynep Arslan", attendeeEmail: "z.arslan@example.com", attendeePhone: "+90 533 555 0177", agentId: "ag1", source: "in-call", status: "booked", cancelledAt: null },
    { callId: "call-d4", bookingUid: "bk_4ee12", startsAt: at(3, 11), attendeeName: "Ahmet Yıldız", attendeeEmail: null, attendeePhone: "+90 542 555 0163", agentId: "ag3", source: "post-call", status: "booked", cancelledAt: null },
    { callId: "call-d5", bookingUid: "bk_2af55", startsAt: at(-2, 14), attendeeName: "Selin Öztürk", attendeeEmail: "selin@example.com", attendeePhone: "+90 536 555 0129", agentId: "ag1", source: "in-call", status: "booked", cancelledAt: null },
    { callId: "call-d6", bookingUid: "bk_8bc03", startsAt: at(2, 12), attendeeName: "Burak Şahin", attendeeEmail: null, attendeePhone: "+90 545 555 0198", agentId: "ag1", source: "in-call", status: "cancelled", cancelledAt: new Date(now - 6 * hour).toISOString() },
  ];

  return rows.map((r, i) => ({
    ...r,
    id: `demo-appt-${i + 1}`,
    createdAt: new Date(now - (i + 1) * 3 * hour).toISOString(),
  }));
}

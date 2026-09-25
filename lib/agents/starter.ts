import type { Agent } from "@/lib/demo/data";
import { defaultWorkingHours } from "@/lib/agents/hours";

/**
 * The four agents a brand-new clinic starts with — so /agents isn't a blank
 * page on first sign-in.
 *
 * Deliberately NOT the demo array (`lib/demo/data.ts` → AGENTS). That one is a
 * sales surface: it ships a fully written hair-transplant clinic, complete
 * with a street address in Etiler and a price policy. Seeding a real clinic
 * from it handed its receptionist another clinic's facts to read out loud.
 *
 * So these carry the shape and nothing else: `{klinik}` in the greeting
 * becomes the clinic's own name at sync time (lib/vapi/client.ts), and
 * `systemPrompt` starts empty — the clinic's real facts arrive from /klinik
 * (`clinic_knowledge`), which every agent of the clinic gets automatically.
 */
export const STARTER_AGENTS: Agent[] = [
  {
    id: "ag1",
    name: "Ön Büro",
    voice: "Defne · warm female",
    active: true,
    callsToday: 0,
    purpose: {
      tr: "Gelen aramaları karşılar, randevu alır, yönlendirir.",
      en: "Greets inbound calls, books appointments and routes.",
    },
    greeting: {
      tr: "{klinik}, iyi günler. Size nasıl yardımcı olabilirim?",
      en: "{klinik}, good day. How can I help you?",
    },
    actionIds: ["book", "transfer", "sms"],
    systemPrompt: "",
    workingHours: defaultWorkingHours(),
  },
  {
    id: "ag2",
    name: "Hasta Danışmanı",
    voice: "Kerem · confident male",
    active: true,
    callsToday: 0,
    purpose: {
      tr: "Müşteri adaylarını nitelendirir ve satışa iletir.",
      en: "Qualifies leads and forwards them to sales.",
    },
    greeting: {
      tr: "{klinik}, merhaba. Hangi konuda yardımcı olabilirim?",
      en: "{klinik}, hello. What can I help you with?",
    },
    actionIds: ["qualify", "crm"],
    systemPrompt: "",
    workingHours: defaultWorkingHours(),
  },
  {
    id: "ag3",
    name: "Randevu Masası",
    voice: "Deniz · calm neutral",
    active: true,
    callsToday: 0,
    purpose: {
      tr: "Hasta randevuları ve rutin talepleri yönetir.",
      en: "Handles patient bookings and routine requests.",
    },
    greeting: {
      tr: "{klinik}, merhaba. Nasıl yardımcı olabilirim?",
      en: "{klinik}, hello. How can I help?",
    },
    actionIds: ["book", "sms"],
    systemPrompt: "",
    workingHours: defaultWorkingHours(),
  },
  {
    id: "ag4",
    name: "Mesai Dışı",
    voice: "Ada · soft female",
    active: false,
    callsToday: 0,
    purpose: {
      tr: "Klinik kapalıyken aramaları karşılar, açık saatlere randevu alır, acil durumu yönlendirir.",
      en: "Answers while the clinic is closed, books into opening hours and points emergencies onward.",
    },
    // It answers from evening to early morning, so no "iyi akşamlar" at 7 a.m.
    greeting: {
      tr: "{klinik}, merhaba. Şu an mesai saatlerimiz dışındayız ama randevunuzu alabilirim. Size nasıl yardımcı olabilirim?",
      en: "{klinik}, hello. We're closed right now, but I can still book you in. How can I help?",
    },
    // Books into the clinic's opening hours; nobody is there to take a transfer.
    actionIds: ["book", "sms"],
    systemPrompt: "",
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

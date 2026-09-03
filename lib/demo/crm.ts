import { AGENTS, CALLS } from "@/lib/demo/data";
import type { CrmRecord } from "@/lib/crm/types";
import type { L, Lang } from "@/lib/i18n/config";

/**
 * Demo CRM log, derived from the same demo calls the rest of the cockpit
 * renders — so /crm shows something real-shaped before Supabase is connected,
 * instead of an empty table. Bilingual copy is flattened here because
 * crm_records stores whatever language the call happened in.
 */
export function demoCrmRecords(lang: Lang): CrmRecord[] {
  const today = new Date();

  const fromCalls = CALLS.map((call, i) => {
    const agent = AGENTS.find((a) => a.id === call.agentId);
    const [hh, mm] = call.time.split(":").map(Number);
    const startedAt = new Date(today);
    startedAt.setDate(today.getDate() - Math.floor(i / 3));
    startedAt.setHours(hh, mm, 0, 0);

    return {
      id: `demo-${call.id}`,
      call_id: call.id,
      agent_id: call.agentId,
      agent_name: agent?.name ?? "Reception",
      caller_name: call.caller,
      caller_number: call.number,
      started_at: startedAt.toISOString(),
      duration_sec: call.durationSec,
      outcome: call.outcome,
      summary: call.summary[lang],
      transcript: call.transcript.map((turn) => ({
        speaker: turn.who,
        text: turn.text[lang],
        atSec: turn.at,
      })),
      actions: call.actions.map((a) => a[lang]),
      created_at: startedAt.toISOString(),
    };
  });

  return [...fromCalls, ...earlierCalls(today, lang)];
}

/**
 * The demo CALLS array is one day of traffic, so every caller in it appears
 * exactly once — which makes a contact-per-row view look pointless. These are
 * earlier calls from callers already in that array, so /crm demonstrates the
 * repeat-caller history it exists for. They live here rather than in CALLS
 * because /calls, the dashboard and the marketing ticker all render that array
 * as "today" and must keep showing exactly those eight rows.
 */
function earlierCalls(today: Date, lang: Lang): CrmRecord[] {
  const daysAgo = (days: number, hh: number, mm: number) => {
    const d = new Date(today);
    d.setDate(today.getDate() - days);
    d.setHours(hh, mm, 0, 0);
    return d.toISOString();
  };

  const rows: {
    callId: string;
    agentId: string;
    callerName: string;
    callerNumber: string;
    startedAt: string;
    durationSec: number;
    outcome: string;
    summary: L;
    actions: L[];
    transcript: { speaker: "agent" | "caller"; atSec: number; text: L }[];
  }[] = [
    {
      callId: "c1-b",
      agentId: "ag1",
      callerName: "Maria Gomez",
      callerNumber: "+1 (415) 555-0182",
      startedAt: daysAgo(6, 11, 5),
      durationSec: 134,
      outcome: "resolved",
      summary: {
        tr: "Randevu almadan önce fiyatlandırmayı ve iptal koşullarını sordu.",
        en: "Asked about pricing and the cancellation policy before booking.",
      },
      actions: [
        { tr: "Fiyat listesi e-postayla gönderildi", en: "Pricing sheet emailed" },
      ],
      transcript: [
        { speaker: "agent", atSec: 0, text: { tr: "Briteline Temizlik, ben Randevox. Nasıl yardımcı olabilirim?", en: "Brightline Cleaning, this is Randevox. How can I help?" } },
        { speaker: "caller", atSec: 5, text: { tr: "Daire temizliği ne kadar tutuyor?", en: "How much does an apartment cleaning cost?" } },
        { speaker: "agent", atSec: 10, text: { tr: "İki odalı bir daire için 120 dolardan başlıyor. Size fiyat listesini gönderebilirim.", en: "It starts at $120 for a two-bedroom. I can email you the full pricing sheet." } },
        { speaker: "caller", atSec: 18, text: { tr: "Olur, gönderin. Sonra tekrar arayacağım.", en: "Yes please. I'll call back after I look at it." } },
      ],
    },
    {
      callId: "c1-c",
      agentId: "ag1",
      callerName: "Maria Gomez",
      callerNumber: "+1 (415) 555-0182",
      startedAt: daysAgo(13, 18, 42),
      durationSec: 21,
      outcome: "voicemail",
      summary: {
        tr: "Mesai dışında aradı, uygunluk için mesaj bıraktı.",
        en: "Called after hours and left a message asking about availability.",
      },
      actions: [
        { tr: "Sesli mesaj ertesi güne işaretlendi", en: "Voicemail flagged for next-day callback" },
      ],
      transcript: [
        { speaker: "agent", atSec: 0, text: { tr: "Şu anda kapalıyız. Mesajınızı bırakırsanız sizi geri arayalım.", en: "We're closed right now. Leave a message and we'll call you back." } },
        { speaker: "caller", atSec: 6, text: { tr: "Merhaba, gelecek hafta için uygunluğunuzu öğrenmek istiyorum.", en: "Hi, I'd like to know your availability for next week." } },
      ],
    },
    {
      callId: "c4-b",
      agentId: "ag3",
      callerName: "Aisha Rahman",
      callerNumber: "+1 (646) 555-0199",
      startedAt: daysAgo(9, 9, 30),
      durationSec: 96,
      outcome: "booked",
      summary: {
        tr: "Altı aylık rutin kontrolünü aldı — bu randevu bugünkü aramada öne çekildi.",
        en: "Booked her six-month check-up — moved earlier on today's call.",
      },
      actions: [
        { tr: "Randevu eklendi — Sal 09:00", en: "Appointment created — Tue 09:00" },
      ],
      transcript: [
        { speaker: "agent", atSec: 0, text: { tr: "Cedar Diş Kliniği, ben Randevox. Nasıl yardımcı olabilirim?", en: "Cedar Dental, this is Randevox. How can I help?" } },
        { speaker: "caller", atSec: 5, text: { tr: "Altı aylık kontrolüm için randevu almam gerekiyor.", en: "I need to book my six-month check-up." } },
        { speaker: "agent", atSec: 11, text: { tr: "Salı sabahı 09:00 uygun mu?", en: "Would Tuesday morning at 09:00 work?" } },
        { speaker: "caller", atSec: 16, text: { tr: "Uygun, teşekkürler.", en: "That works, thank you." } },
      ],
    },
  ];

  return rows.map((r) => {
    const agent = AGENTS.find((a) => a.id === r.agentId);
    return {
      id: `demo-${r.callId}`,
      call_id: r.callId,
      agent_id: r.agentId,
      agent_name: agent?.name ?? "Reception",
      caller_name: r.callerName,
      caller_number: r.callerNumber,
      started_at: r.startedAt,
      duration_sec: r.durationSec,
      outcome: r.outcome,
      summary: r.summary[lang],
      transcript: r.transcript.map((turn) => ({
        speaker: turn.speaker,
        text: turn.text[lang],
        atSec: turn.atSec,
      })),
      actions: r.actions.map((a) => a[lang]),
      created_at: r.startedAt,
    };
  });
}

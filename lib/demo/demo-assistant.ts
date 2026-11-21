import { AGENTS } from "@/lib/demo/data";
import type { ClinicKnowledge } from "@/lib/clinics/knowledge-shape";
import type { ClinicContext } from "@/lib/clinics/server";
import { upsertAssistant, type VapiResult } from "@/lib/vapi/client";
import { DEMO_CALL_MAX_SECONDS } from "@/lib/demo/try-call";

/**
 * Vapi assistants for browser demos: the landing page's public one
 * (scripts/sync-demo-assistant.ts) and each clinic trial's own
 * (lib/demo/trials-server.ts). Built through the same buildAssistant as a
 * real clinic's agent, so the demo sounds exactly like the product — then
 * capped at three minutes, recording off, no post-call analysis.
 */
export function upsertDemoAssistant(opts: {
  clinicName: string;
  knowledge: ClinicKnowledge;
  existingId: string | null;
  /** Clinic trials report their calls so the webhook can count them. */
  trialId?: string;
  /** Only while recording the landing page's sample calls. */
  record?: boolean;
}): Promise<VapiResult<{ id: string; created: boolean }>> {
  const { clinicName, knowledge, existingId, trialId, record = false } = opts;
  const trial = Boolean(trialId);

  const agent = {
    ...AGENTS[0],
    id: trialId ? `trial-${trialId}` : "web-demo",
    name: trial ? "Deneme" : "Web demo",
    voice: "Lyra · warm female",
    actionIds: ["book" as const],
    greeting: { tr: "Merhaba, {klinik}. Size nasıl yardımcı olabilirim?", en: "Hello, {klinik}. How can I help you?" },
    systemPrompt: [
      trial
        ? `Bu hat, ${clinicName} için hazırlanmış Randevox deneme hattıdır. Arayan büyük ihtimalle klinik sahibi ya da çalışanıdır ve ajanı deniyor; onunla gerçek bir hasta gibi konuş.`
        : "Bu hat, Randevox'un web sitesindeki tanıtım hattıdır. Arayan, gerçek bir hasta değil, Randevox'u deneyen biridir; yine de onunla gerçek bir hasta gibi konuş.",
      trial
        ? "Deneme süresince alınan randevular kliniğin takvimine yazılmaz. Arayan sorarsa bunu açıkça söyle."
        : "Klinik kurgusaldır ve alınan randevular gerçek değildir. Arayan sorarsa bunu açıkça söyle.",
      "Görüşme en fazla üç dakika sürer; cevaplarını kısa tut.",
      record
        ? "Bu görüşme web sitesinde örnek olarak yayınlanmak üzere kaydediliyor."
        : "Bu görüşme KAYDEDİLMEZ. Açılış bölümündeki kayıt cümlesi bu hat için geçerli değil; açılışta kayıt yapılmadığı söylendi. Kayıt sorulursa kaydedilmediğini söyle.",
      "Tıbbi soru sorulursa (ilaç, iyileşme süreci, komplikasyon) cevaplama, hekimin muayenede değerlendireceğini söyle.",
    ].join("\n"),
  };

  const clinic: ClinicContext = {
    id: "00000000-0000-4000-8000-0000000de300",
    name: clinicName,
    plan: "klinik",
    status: "active",
    timeZone: "Europe/Istanbul",
    transferNumber: null,
    notifyEmail: null,
    crmWebhookUrl: null,
    vapiPhoneNumberId: null,
    messageChannel: "off",
    callbackAgentId: null,
    vapiOutboundPhoneNumberId: null,
    dayAgentId: null,
    afterHoursAgentId: null,
  };

  const notice = record
    ? "Bu görüşme örnek olarak yayınlanmak üzere kaydediliyor."
    : trial
      ? "Bu bir deneme görüşmesidir ve kaydedilmez."
      : "Bu bir tanıtım görüşmesidir ve kaydedilmez.";

  return upsertAssistant(agent, clinic, existingId, knowledge, null, {
    // Vapi caps the name at 40 characters.
    name: (trial ? `Deneme · ${clinicName}` : "Randevox · Web demo").slice(0, 40),
    // The standard notice says the call is recorded — this one isn't (unless record).
    firstMessage: `Merhaba, ${clinicName}. Ben yapay zekâ asistanıyım. ${notice} Size nasıl yardımcı olabilirim?`,
    maxDurationSeconds: DEMO_CALL_MAX_SECONDS,
    artifactPlan: { recordingEnabled: record },
    // No summary or extraction: nothing reads them for a demo.
    analysisPlan: { summaryPlan: { enabled: false }, structuredDataPlan: { enabled: false } },
    // A trial's end-of-call report is how its calls are counted.
    serverMessages: trial ? ["tool-calls", "end-of-call-report"] : ["tool-calls"],
    metadata: trial ? { demo: true, demoTrialId: trialId } : { demo: true },
  });
}

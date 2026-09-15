import type { ActionResult, CallActionPayload } from "@/lib/actions/types";
import { isAutomationConfigured } from "@/lib/automation/emit";
import { toE164 } from "@/lib/vapi/client";

/**
 * The patient's confirmation message. Nothing is sent from here: the webhook
 * emits `call.completed` to n8n once the call is logged (with `confirm: true`
 * when this action is on), and n8n sends the approved WhatsApp template. This
 * executor only reports, on the call's action list, whether that will happen.
 */
export async function runSms(payload: CallActionPayload): Promise<ActionResult> {
  const { clinic } = payload;
  if (!clinic) {
    return { actionId: "sms", status: "demo", note: `Demo mod — ${payload.number} için onay mesajı gönderilmedi.` };
  }
  if (!clinic.whatsappEnabled) {
    return { actionId: "sms", status: "demo", note: "Bu klinikte WhatsApp mesajları kapalı — onay gönderilmedi." };
  }
  if (!isAutomationConfigured()) {
    return { actionId: "sms", status: "error", note: "Otomasyon bağlı değil (N8N_EVENTS_URL / AUTOMATION_SECRET yok)." };
  }
  if (!toE164(payload.number)) {
    return { actionId: "sms", status: "error", note: "Arayanın numarası okunamadı — WhatsApp onayı gönderilemez." };
  }
  return { actionId: "sms", status: "ok", note: "Randevu alındıysa onay WhatsApp ile gönderilecek." };
}

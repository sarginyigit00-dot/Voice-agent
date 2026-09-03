import type { ActionResult, CallActionPayload } from "@/lib/actions/types";

/**
 * Sends the confirmation SMS via Twilio once its keys are set. Real send
 * wiring (message body, recipient number formatting) is left for a project
 * that connects Twilio for real — this stub keeps the same
 * demo/ok/error contract as the other executors so the pipeline in
 * lib/actions/run.ts doesn't special-case it.
 */
export async function runSms(payload: CallActionPayload): Promise<ActionResult> {
  const configured = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER;
  if (!configured) {
    return { actionId: "sms", status: "demo", note: `Twilio anahtarları yok — ${payload.number} için SMS demo modda kaydedildi.` };
  }
  return { actionId: "sms", status: "demo", note: "Twilio anahtarları bulundu, ama gönderim çağrısı henüz bağlanmadı." };
}

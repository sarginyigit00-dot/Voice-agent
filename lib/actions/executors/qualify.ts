import type { ActionResult, CallActionPayload } from "@/lib/actions/types";

/**
 * Lead scoring doesn't need an external service — it can run entirely on the
 * transcript already in the payload. This is a placeholder heuristic (word
 * count as a stand-in signal) until a project wires a real scoring prompt
 * through its LLM integration (OPENAI_API_KEY or ANTHROPIC_API_KEY).
 */
export async function runQualify(payload: CallActionPayload): Promise<ActionResult> {
  const hasLlm = !!process.env.OPENAI_API_KEY || !!process.env.ANTHROPIC_API_KEY;
  if (!hasLlm) {
    return { actionId: "qualify", status: "demo", note: "LLM anahtarı yok — nitelendirme demo modda kaydedildi." };
  }
  const words = payload.transcript.reduce((n, turn) => n + turn.text.split(/\s+/).length, 0);
  return { actionId: "qualify", status: "demo", note: `LLM anahtarı bulundu, ama puanlama çağrısı henüz bağlanmadı (${words} kelimelik transkript hazır).` };
}

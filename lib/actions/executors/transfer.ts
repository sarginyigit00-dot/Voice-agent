import type { ActionResult, CallActionPayload } from "@/lib/actions/types";

/**
 * "Transfer" is NOT a post-call webhook action — Vapi performs it live,
 * mid-call, through the `transferCall` tool lib/vapi/client.ts puts on the
 * assistant (pointed at the clinic's transfer number). By the time this runs
 * the call is over, so all it does is record whether the hand-over happened —
 * or flag that it never could.
 */
export async function runTransfer(payload: CallActionPayload): Promise<ActionResult> {
  // Demo mode: no clinic, no real line.
  if (!payload.clinic) {
    return {
      actionId: "transfer",
      status: "demo",
      note: `${payload.callId}: transfer, Vapi'nin çağrı akışında gerçekleşir — bu adımda yapılacak ayrı bir çağrı yok.`,
    };
  }

  if (payload.outcome === "transferred") {
    return {
      actionId: "transfer",
      status: "ok",
      note: payload.clinic.transferNumber
        ? `Arayan ${payload.clinic.transferNumber} numarasına aktarıldı.`
        : "Arayan canlı temsilciye aktarıldı.",
    };
  }

  if (!payload.clinic.transferNumber) {
    return {
      actionId: "transfer",
      status: "error",
      note: "Aktarma açık ama klinikte aktarma numarası yok — ajan kimseyi aktaramaz.",
    };
  }

  return { actionId: "transfer", status: "ok", note: "Aktarma gerekmedi." };
}

import type { ActionResult, CallActionPayload } from "@/lib/actions/types";

/**
 * "Transfer" is NOT a post-call webhook action — Vapi performs it live,
 * mid-call, via a `transferCall` tool declared on the assistant config. There
 * is nothing for this pipeline to call after the fact, so this executor only
 * reports that fact instead of pretending to make a request. See
 * lib/actions/registry.ts ACTION_HINT for the copy shown next to the toggle.
 */
export async function runTransfer(payload: CallActionPayload): Promise<ActionResult> {
  return {
    actionId: "transfer",
    status: "demo",
    note: `${payload.callId}: transfer, Vapi'nin çağrı akışında gerçekleşir — bu adımda yapılacak ayrı bir çağrı yok.`,
  };
}

import type { ActionId } from "@/lib/actions/registry";
import type { ActionResult, CallActionPayload } from "@/lib/actions/types";
import { runBook } from "@/lib/actions/executors/book";
import { runTransfer } from "@/lib/actions/executors/transfer";
import { runSms } from "@/lib/actions/executors/sms";
import { runCrm } from "@/lib/actions/executors/crm";
import { runQualify } from "@/lib/actions/executors/qualify";

const EXECUTORS: Record<ActionId, (payload: CallActionPayload) => Promise<ActionResult>> = {
  book: runBook,
  transfer: runTransfer,
  sms: runSms,
  crm: runCrm,
  qualify: runQualify,
};

/**
 * Runs every action enabled on the agent that handled this call, in
 * parallel. One executor failing (network error, bad webhook) never blocks
 * the others — each result is independent and reported back individually.
 *
 * `allSettled`, not `all`: an executor that throws outside its own try/catch —
 * or an `action_ids` value from the database with no executor behind it —
 * would otherwise reject the whole webhook. Vapi retries a non-200, and the
 * retry re-runs every action, which is how one call becomes two bookings.
 */
export async function runAgentActions(actionIds: ActionId[], payload: CallActionPayload): Promise<ActionResult[]> {
  const settled = await Promise.allSettled(
    actionIds.map((id) => {
      const executor = EXECUTORS[id];
      if (!executor) {
        return Promise.resolve<ActionResult>({
          actionId: id,
          status: "error",
          note: `Bilinmeyen eylem: ${id}`,
        });
      }
      return executor(payload);
    }),
  );

  return settled.map((outcome, i) =>
    outcome.status === "fulfilled"
      ? outcome.value
      : {
          actionId: actionIds[i],
          status: "error" as const,
          note: `Eylem beklenmedik şekilde başarısız oldu: ${outcome.reason}`,
        },
  );
}

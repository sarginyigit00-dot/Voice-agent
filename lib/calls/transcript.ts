/**
 * One transcript shape for the whole app: who spoke, what they said, and how
 * many seconds into the call.
 *
 * Vapi's end-of-call report is not that. Its `messages` carry roles `bot` /
 * `user` (not `assistant` / `caller`), a `system` row holding the ENTIRE
 * system prompt, empty `tool_calls` / `tool_call_result` rows, and `time` as
 * an epoch timestamp in ms. Stored raw, the panel showed the agent's lines as
 * the patient's, opened every call with the internal prompt as if the caller
 * had said it, and stamped each line "29836578 minutes in".
 *
 * Accepts both the raw Vapi rows and the rows already stored before this
 * existed, so old calls read correctly without touching the database.
 */

export interface TranscriptTurn {
  speaker: "agent" | "caller";
  text: string;
  atSec: number;
}

const AGENT_ROLES = new Set(["bot", "assistant", "agent"]);
const CALLER_ROLES = new Set(["user", "customer", "caller"]);

/** Anything larger is an epoch timestamp, not seconds from the start of a call. */
const EPOCH_THRESHOLD = 1e9;

type RawTurn = {
  role?: unknown;
  speaker?: unknown;
  message?: unknown;
  text?: unknown;
  secondsFromStart?: unknown;
  time?: unknown;
  atSec?: unknown;
};

export function cleanTranscript(raw: unknown): TranscriptTurn[] {
  if (!Array.isArray(raw)) return [];

  const spoken: { speaker: TranscriptTurn["speaker"]; text: string; at: number }[] = [];
  for (const row of raw as RawTurn[]) {
    const role = String(row?.role ?? row?.speaker ?? "");
    const speaker = AGENT_ROLES.has(role) ? "agent" : CALLER_ROLES.has(role) ? "caller" : null;
    // system prompt, tool calls, tool results — never something anyone said
    if (!speaker) continue;

    const text = String(row.message ?? row.text ?? "").trim();
    if (!text) continue;

    const at = Number(row.secondsFromStart ?? row.time ?? row.atSec ?? 0);
    spoken.push({ speaker, text, at: Number.isFinite(at) ? at : 0 });
  }

  // Epoch-ms stamps become seconds from the first spoken line.
  const first = spoken.find((t) => t.at > EPOCH_THRESHOLD)?.at;
  return spoken.map(({ speaker, text, at }) => ({
    speaker,
    text,
    atSec: first !== undefined && at > EPOCH_THRESHOLD ? Math.max(0, Math.round((at - first) / 1000)) : Math.round(at),
  }));
}

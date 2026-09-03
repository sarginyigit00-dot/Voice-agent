/** What a finished call looks like by the time actions run against it. */
export interface CallActionPayload {
  callId: string;
  agentId: string;
  agentName: string;
  caller: string;
  number: string;
  startedAt: string;
  durationSec: number;
  outcome: string;
  summary: string;
  /**
   * The slot the caller actually asked for, ISO-8601. Populated from Vapi's
   * structured-data extraction on the end-of-call report (see
   * app/api/vapi/webhook/route.ts).
   *
   * Only the post-call safety net in lib/actions/executors/book.ts reads it,
   * and only when the mid-call booking tool never fired — normally the
   * appointment already exists by then. Absent means "the time was never
   * established", which `book` reports rather than guessing.
   */
  requestedStart?: string;
  /**
   * The caller's email when they gave one, so Cal.com can send *them* the
   * confirmation. Without it the booking falls back to BOOKING_FALLBACK_EMAIL
   * (the clinic's own inbox) and carries the phone number in its notes.
   */
  callerEmail?: string;
  /** Computed once, in parallel with the action pipeline — see lib/calls/sentiment.ts. */
  sentiment: "positive" | "neutral" | "negative";
  /** Vapi's recording URL, when the assistant had recording enabled. */
  recordingUrl?: string;
  transcript: { speaker: string; text: string; atSec: number }[];
}

export type ActionStatus = "ok" | "demo" | "error";

export interface ActionResult {
  actionId: string;
  status: ActionStatus;
  /** Short human-readable note — shown in the call's "Çıkarılan eylemler" list. */
  note: string;
}

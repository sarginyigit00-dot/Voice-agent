import { NextResponse } from "next/server";
import { runAgentActions } from "@/lib/actions/run";
import type { CallActionPayload } from "@/lib/actions/types";
import { logCall } from "@/lib/calls/log";
import { isBookingTool, runBookingTool, type ToolContext } from "@/lib/booking/tools";
import { computeSentiment } from "@/lib/calls/sentiment";
import { cleanTranscript } from "@/lib/calls/transcript";
import { clinicOpeningHours, isAfterHoursAgent, resolveCallOwner } from "@/lib/clinics/server";
import { routeInboundCall } from "@/lib/vapi/routing";
import { findByCall } from "@/lib/booking/store";
import { toE164, webhookSecret } from "@/lib/vapi/client";
import { emitEvent } from "@/lib/automation/emit";
import { localParts } from "@/lib/automation/format";
import { markLeadCallEnded } from "@/lib/leads/callback";
import type { Outcome } from "@/lib/demo/data";

/**
 * Vapi's server URL. Every assistant provisioned by lib/vapi/client.ts points
 * here and sends VAPI_WEBHOOK_SECRET back in `x-vapi-secret` on every webhook.
 * https://docs.vapi.ai/server-url
 *
 * Two message types matter:
 *
 * - `tool-calls` — fired **mid-call**, while the caller is still on the line.
 *   This is how booking actually works: the agent calls check_availability to
 *   offer real openings and book_appointment to take one, and hears the result
 *   in time to confirm it out loud. Handled by lib/booking/tools.ts.
 * - `end-of-call-report` — fired once the call is over, with the transcript and
 *   summary. Runs the post-call actions and logs the call.
 *
 * Anything else (status updates, speech events) is acked and ignored.
 */
export async function POST(req: Request) {
  const expected = webhookSecret();
  // Fail closed, not open: without a configured key there is no secret to
  // check the request against, and this route holds the service-role key —
  // accepting it anyway meant anyone could forge a call, inject fabricated
  // transcripts, and trigger a real Cal.com booking. No key means no
  // legitimate caller either, since Vapi is the only thing that should ever
  // reach this URL.
  if (!expected) {
    return NextResponse.json({ error: "Vapi entegrasyonu yapılandırılmamış (VAPI_WEBHOOK_SECRET yok)." }, { status: 503 });
  }

  const secret = req.headers.get("x-vapi-secret");
  if (secret !== expected) {
    return NextResponse.json({ error: "invalid secret" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const message = body?.message;
  if (!message) return NextResponse.json({ ok: true });

  // Inbound call on a number in routing mode: pick the day or after-hours agent (lib/vapi/routing.ts).
  if (message.type === "assistant-request") {
    const routed = await routeInboundCall(message.call?.phoneNumberId);
    if ("error" in routed) return NextResponse.json({ error: routed.error });
    return NextResponse.json({ assistantId: routed.assistantId });
  }
  if (message.type === "tool-calls") return handleToolCalls(message as VapiToolCallsMessage);
  if (message.type === "end-of-call-report") return handleEndOfCall(message as VapiEndOfCallMessage);

  return NextResponse.json({ ok: true });
}

/* ───────────────────────── Vapi payload shapes ───────────────────────── */

/**
 * Vapi's own docs disagree on the exact shape of a recorded call's artifact
 * (a flat `recordingUrl`, or `artifact.recording.stereoUrl`, or
 * `artifact.recording.mono.combinedUrl`) — this project has no Vapi
 * connection yet to check a real payload against. `recordingUrlFrom` below
 * tries every candidate path rather than committing to one; verify against a
 * real end-of-call-report once Vapi is connected and narrow this if needed.
 */
interface VapiArtifact {
  recordingUrl?: string;
  recording?: { stereoUrl?: string; mono?: { combinedUrl?: string } };
}

interface VapiCall {
  id?: string;
  assistantId?: string;
  startedAt?: string;
  customer?: { number?: string; name?: string };
  artifact?: VapiArtifact;
  recordingUrl?: string;
}

interface VapiToolCall {
  id: string;
  name: string;
  arguments?: Record<string, unknown>;
  parameters?: Record<string, unknown>;
}

/**
 * What Vapi actually sends: OpenAI-shaped `{ id, type, function: { name,
 * arguments } }`, arguments sometimes a JSON string. Older payloads (and our
 * tests) put `name` / `arguments` at the top level — both are accepted.
 */
interface RawToolCall {
  id: string;
  name?: string;
  arguments?: Record<string, unknown> | string;
  parameters?: Record<string, unknown>;
  function?: { name?: string; arguments?: Record<string, unknown> | string };
}

interface VapiToolCallsMessage {
  call?: VapiCall;
  toolCallList?: RawToolCall[];
  toolWithToolCallList?: { name?: string; function?: { name?: string }; toolCall: RawToolCall }[];
}

function normalizeToolCall(raw: RawToolCall): VapiToolCall {
  let args = raw.arguments ?? raw.function?.arguments ?? raw.parameters ?? {};
  if (typeof args === "string") {
    try {
      args = JSON.parse(args) as Record<string, unknown>;
    } catch {
      args = {};
    }
  }
  return { id: raw.id, name: raw.name ?? raw.function?.name ?? "", arguments: args };
}

interface VapiEndOfCallMessage {
  call?: VapiCall;
  /** Fractional (e.g. 16.4) — `calls.duration_sec` is an integer. */
  durationSeconds?: number;
  startedAt?: string;
  endedReason?: string;
  summary?: string;
  analysis?: { structuredData?: Record<string, unknown> };
  messages?: { role: string; message: string; time?: number }[];
  artifact?: VapiArtifact;
  recordingUrl?: string;
}

/** Tries every documented shape Vapi might have put the recording URL under. */
function recordingUrlFrom(message: VapiEndOfCallMessage): string | undefined {
  const candidates = [
    message.call?.artifact?.recording?.stereoUrl,
    message.call?.artifact?.recording?.mono?.combinedUrl,
    message.call?.artifact?.recordingUrl,
    message.call?.recordingUrl,
    message.artifact?.recording?.stereoUrl,
    message.artifact?.recording?.mono?.combinedUrl,
    message.artifact?.recordingUrl,
    message.recordingUrl,
  ];
  return candidates.find((c): c is string => typeof c === "string" && c.length > 0);
}

/* ─────────────────────────── mid-call tools ─────────────────────────── */

/**
 * Vapi expects `{ results: [{ name, toolCallId, result }] }`, with `result` a
 * string. Every tool call in the batch must come back — a missing id leaves
 * the model waiting mid-conversation — so unknown tools get an explicit
 * "not implemented" result rather than being dropped.
 */
async function handleToolCalls(message: VapiToolCallsMessage) {
  const list: VapiToolCall[] = (
    message.toolCallList ??
    message.toolWithToolCallList?.map((t) => ({ ...t.toolCall, name: t.name ?? t.function?.name })) ??
    []
  ).map(normalizeToolCall);

  const call = message.call ?? {};
  // Resolve the agent — and through it the clinic — so the tools book into
  // THIS clinic's calendar, inside this line's working hours.
  const owner = await resolveCallOwner(call.assistantId);
  if (!owner) {
    console.error(`[vapi] tool-calls from unknown assistant ${call.assistantId ?? "(none)"} — refused`);
  }

  // Every tool call still gets an answer, or the model stalls mid-sentence —
  // so an unknown line or a suspended clinic hands the caller to a person
  // instead of touching any calendar.
  const refusal = !owner
    ? "Sistemde bir sorun oldu. Sizi bir yetkiliye aktarayım."
    : owner.clinic?.status === "suspended"
      ? "Şu anda randevu alamıyorum. Sizi bir yetkiliye aktarayım."
      : null;

  const ctx: ToolContext | null = owner
    ? {
        clinic: owner.clinic,
        callId: call.id ?? "unknown",
        callerNumber: call.customer?.number ?? "",
        callerName: call.customer?.name ?? "Unknown",
        agentId: owner.agent.id,
        // The after-hours line answers at night but books into the clinic's
        // opening hours — never into its own.
        workingHours: isAfterHoursAgent(owner.clinic, owner.agent.id)
          ? ((owner.clinic && (await clinicOpeningHours(owner.clinic))) ?? owner.agent.workingHours)
          : owner.agent.workingHours,
      }
    : null;

  const results = await Promise.all(
    list.map(async (toolCall) => {
      const args = toolCall.arguments ?? toolCall.parameters ?? {};
      let result: string;

      if (refusal || !ctx) {
        result = JSON.stringify({ ok: false, spoken: refusal });
      } else if (isBookingTool(toolCall.name)) {
        try {
          result = await runBookingTool(toolCall.name, args, ctx);
        } catch (e) {
          console.error(`[vapi] tool ${toolCall.name} threw:`, e);
          result = JSON.stringify({
            ok: false,
            spoken: "Sistemde bir sorun oldu. Sizi bir yetkiliye aktarayım.",
          });
        }
      } else {
        result = JSON.stringify({ ok: false, error: `Unknown tool: ${toolCall.name}` });
      }

      return { name: toolCall.name, toolCallId: toolCall.id, result };
    }),
  );

  return NextResponse.json({ results });
}

/* ────────────────────────── end-of-call report ────────────────────────── */

/**
 * The slot and email Vapi's structured-data extraction pulled off the call.
 * Configure the assistant's `analysisPlan.structuredDataSchema` with
 * `requestedStart` (ISO-8601) and `callerEmail` for this to be populated;
 * without it the post-call booking net simply reports that the time was never
 * established, which is the honest outcome.
 */
function extracted(message: VapiEndOfCallMessage): { requestedStart?: string; callerEmail?: string } {
  const data = message.analysis?.structuredData ?? {};
  const start = data.requestedStart ?? data.requested_start ?? data.appointmentTime;
  const email = data.callerEmail ?? data.caller_email ?? data.email;
  return {
    requestedStart: typeof start === "string" && start.trim() ? start.trim() : undefined,
    callerEmail: typeof email === "string" && email.includes("@") ? email.trim() : undefined,
  };
}

/**
 * Vapi's endedReason folded into the five outcomes /calls, the dashboard
 * donut and the CRM understand (lib/demo/data.ts → Outcome). The raw reason
 * ("customer-ended-call") used to be stored as-is and matched none of them.
 * "booked" is decided after the actions run, from the appointments table.
 * https://docs.vapi.ai/calls/call-ended-reason
 */
function outcomeFrom(endedReason: string | undefined): Outcome {
  const r = endedReason ?? "";
  if (r.includes("forwarded")) return "transferred";
  if (r === "voicemail") return "voicemail";
  if (
    r === "customer-did-not-answer" ||
    r === "customer-busy" ||
    r === "silence-timed-out" ||
    r.includes("error") ||
    r.includes("failed")
  ) {
    return "missed";
  }
  return "resolved";
}

async function handleEndOfCall(message: VapiEndOfCallMessage) {
  const call = message.call ?? {};
  const owner = await resolveCallOwner(call.assistantId);
  if (!owner) {
    // 200, not an error: Vapi retries a non-200, and no retry will ever make
    // this call belong to a clinic. Logged so the operator can spot an
    // assistant pointed at this URL that was never linked to an agent.
    console.error(`[vapi] end-of-call-report from unknown assistant ${call.assistantId ?? "(none)"} — not logged`);
    return NextResponse.json({ ok: true, ignored: "unknown assistant" });
  }
  const { agent, clinic } = owner;

  // Vapi's raw rows include the system prompt and tool calls — see cleanTranscript.
  const transcript = cleanTranscript(message.messages);

  const payload: CallActionPayload = {
    clinic,
    callId: call.id ?? "unknown",
    agentId: agent.id,
    agentName: agent.name,
    caller: call.customer?.name ?? "Unknown",
    number: call.customer?.number ?? "",
    // The report carries startedAt at its top level; call.startedAt is often absent.
    startedAt: call.startedAt ?? message.startedAt ?? new Date().toISOString(),
    durationSec: Math.round(message.durationSeconds ?? 0),
    outcome: outcomeFrom(message.endedReason),
    summary: message.summary ?? "",
    sentiment: "neutral", // overwritten below once computeSentiment resolves
    recordingUrl: recordingUrlFrom(message),
    ...extracted(message),
    transcript,
  };

  // Runs alongside the action pipeline, not before it — an LLM call must
  // never add latency to whatever Vapi is waiting on for this response.
  // A suspended clinic's calls are still logged — usage is what the invoice
  // is cut from — but none of its actions (booking, CRM, messages) run.
  const actionIds = clinic?.status === "suspended" ? [] : agent.actionIds;
  const [results, sentiment] = await Promise.all([
    runAgentActions(actionIds, payload),
    computeSentiment(transcript),
  ]);
  payload.sentiment = sentiment;
  // A booking outranks whatever the line did next — made in-call or by the post-call net.
  const appointment = await findByCall(payload.callId);
  if (appointment) payload.outcome = "booked";

  await logCall(payload, results);
  // A no-op unless this was a Hızlı geri dönüş call.
  await markLeadCallEnded(payload.callId, payload.outcome);

  // After the log, so n8n never hears about a call the panel doesn't have.
  // Suspended clinics run no actions, and that includes messages.
  if (clinic && clinic.status !== "suspended") {
    await emitEvent(clinic, "call.completed", {
      callId: payload.callId,
      agentName: payload.agentName,
      caller: payload.caller,
      number: payload.number,
      phone: toE164(payload.number),
      startedAt: payload.startedAt,
      durationSec: payload.durationSec,
      outcome: payload.outcome,
      sentiment: payload.sentiment,
      summary: payload.summary,
      // The patient's confirmation (SMS / WhatsApp) goes out only if this agent has it on.
      confirm: actionIds.includes("sms"),
      appointment: appointment
        ? {
            startsAt: appointment.startsAt,
            ...localParts(appointment.startsAt, clinic.timeZone),
            attendeeName: appointment.attendeeName,
          }
        : null,
    });
  }

  return NextResponse.json({ ok: true, results });
}

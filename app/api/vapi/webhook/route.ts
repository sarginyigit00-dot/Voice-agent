import { NextResponse } from "next/server";
import { AGENTS, type Agent } from "@/lib/demo/data";
import { runAgentActions } from "@/lib/actions/run";
import type { CallActionPayload } from "@/lib/actions/types";
import { getSupabaseServer } from "@/lib/supabase/server";
import { logCall } from "@/lib/calls/log";
import { isBookingTool, runBookingTool, type ToolContext } from "@/lib/booking/tools";
import { normalizeWorkingHours } from "@/lib/agents/hours";
import { computeSentiment } from "@/lib/calls/sentiment";

/** Real agents when Supabase is configured, otherwise the demo set. */
async function loadAgents(): Promise<Agent[]> {
  const supabase = getSupabaseServer();
  if (!supabase) return AGENTS;

  const { data, error } = await supabase.from("agents").select("*");
  if (error || !data?.length) return AGENTS;

  return data.map((r) => ({
    id: r.id,
    name: r.name,
    voice: r.voice,
    purpose: r.purpose,
    greeting: r.greeting,
    active: r.active,
    callsToday: r.calls_today,
    actionIds: r.action_ids,
    systemPrompt: r.system_prompt ?? "",
    workingHours: normalizeWorkingHours(r.working_hours),
  }));
}

/**
 * Vapi's server URL. Point your assistant (or a phone number's serverUrl) here
 * and set VAPI_API_KEY both in this app and as the assistant's shared secret —
 * Vapi echoes it back in `x-vapi-secret` on every webhook.
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
  const apiKey = process.env.VAPI_API_KEY;
  // Fail closed, not open: without a configured key there is no secret to
  // check the request against, and this route holds the service-role key —
  // accepting it anyway meant anyone could forge a call, inject fabricated
  // transcripts, and trigger a real Cal.com booking. No key means no
  // legitimate caller either, since Vapi is the only thing that should ever
  // reach this URL.
  if (!apiKey) {
    return NextResponse.json({ error: "Vapi entegrasyonu yapılandırılmamış (VAPI_API_KEY yok)." }, { status: 503 });
  }

  const secret = req.headers.get("x-vapi-secret");
  if (secret !== apiKey) {
    return NextResponse.json({ error: "invalid secret" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const message = body?.message;
  if (!message) return NextResponse.json({ ok: true });

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

interface VapiToolCallsMessage {
  call?: VapiCall;
  toolCallList?: VapiToolCall[];
  toolWithToolCallList?: { name: string; toolCall: VapiToolCall }[];
}

interface VapiEndOfCallMessage {
  call?: VapiCall;
  durationSeconds?: number;
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
  const list: VapiToolCall[] =
    message.toolCallList ??
    message.toolWithToolCallList?.map((t) => ({ ...t.toolCall, name: t.name })) ??
    [];

  const call = message.call ?? {};
  // Resolve the agent so the tools know this line's working hours — an agent
  // must not offer a slot the clinic's phone line is closed for.
  const agents = await loadAgents();
  const agent = agents.find((a) => a.id === call.assistantId) ?? agents[0];

  const ctx: ToolContext = {
    callId: call.id ?? "unknown",
    callerNumber: call.customer?.number ?? "",
    callerName: call.customer?.name ?? "Unknown",
    agentId: agent.id,
    workingHours: agent.workingHours,
  };

  const results = await Promise.all(
    list.map(async (toolCall) => {
      const args = toolCall.arguments ?? toolCall.parameters ?? {};
      let result: string;

      if (isBookingTool(toolCall.name)) {
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

async function handleEndOfCall(message: VapiEndOfCallMessage) {
  const call = message.call ?? {};
  const agents = await loadAgents();
  const agent = agents.find((a) => a.id === call.assistantId) ?? agents[0];

  const transcript = (message.messages ?? []).map((m: { role: string; message: string; time?: number }) => ({
    speaker: m.role,
    text: m.message,
    atSec: m.time ?? 0,
  }));

  const payload: CallActionPayload = {
    callId: call.id ?? "unknown",
    agentId: agent.id,
    agentName: agent.name,
    caller: call.customer?.name ?? "Unknown",
    number: call.customer?.number ?? "",
    startedAt: call.startedAt ?? new Date().toISOString(),
    durationSec: message.durationSeconds ?? 0,
    outcome: message.endedReason ?? "completed",
    summary: message.summary ?? "",
    sentiment: "neutral", // overwritten below once computeSentiment resolves
    recordingUrl: recordingUrlFrom(message),
    ...extracted(message),
    transcript,
  };

  // Runs alongside the action pipeline, not before it — an LLM call must
  // never add latency to whatever Vapi is waiting on for this response.
  const [results, sentiment] = await Promise.all([
    runAgentActions(agent.actionIds, payload),
    computeSentiment(transcript),
  ]);
  payload.sentiment = sentiment;

  await logCall(payload, results);
  return NextResponse.json({ ok: true, results });
}

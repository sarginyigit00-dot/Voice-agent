import appConfig from "@/app.config";
import type { Agent } from "@/lib/demo/data";
import type { ClinicContext } from "@/lib/clinics/server";
import { composeSystemPrompt } from "@/lib/agents/prompt";
import type { ClinicKnowledge } from "@/lib/clinics/knowledge-shape";

/**
 * Vapi's REST API — server-side only (it carries the private key).
 *
 * This is what replaced "copy the Tam talimat into the Vapi dashboard": every
 * agent saved on /agents is pushed here as a complete Vapi assistant — prompt,
 * greeting, voice, the in-call booking tools, a live transfer to the clinic's
 * number, where to send webhooks and what to extract after the call. The Vapi
 * dashboard is then only used for phone numbers / SIP, never for agents.
 * https://docs.vapi.ai/api-reference
 */

const API = "https://api.vapi.ai";

/** Fixed per product, not per clinic: Turkish-first, cheap enough for the package margins. */
const MODEL = { provider: "openai", model: "gpt-4o-mini", temperature: 0.3 } as const;
const TRANSCRIBER = { provider: "deepgram", model: "nova-2", language: "tr" } as const;

/**
 * The /agents voice labels (lib/demo/data.ts → VOICES) are personas, not
 * provider ids. Azure has two Turkish neural voices, so every persona lands on
 * one of them by gender.
 */
const AZURE_TR = { female: "tr-TR-EmelNeural", male: "tr-TR-AhmetNeural" } as const;

export function voiceFor(label: string): { provider: "azure"; voiceId: string } {
  // \bmale\b doesn't match inside "female".
  return { provider: "azure", voiceId: /\bmale\b/i.test(label) ? AZURE_TR.male : AZURE_TR.female };
}

export function isVapiConfigured(): boolean {
  return Boolean(process.env.VAPI_API_KEY?.trim());
}

/**
 * The shared secret Vapi echoes back in `x-vapi-secret` on every webhook.
 * Separate from the API key so the key never has to leave this server; falls
 * back to the key only so a deployment that predates VAPI_WEBHOOK_SECRET keeps
 * accepting its hand-configured assistants.
 */
export function webhookSecret(): string | null {
  return process.env.VAPI_WEBHOOK_SECRET?.trim() || process.env.VAPI_API_KEY?.trim() || null;
}

/**
 * Always the public production URL, even when the sync runs from a laptop:
 * Vapi can't reach localhost, and an assistant pointed there goes silent on
 * every real call. Override with VAPI_SERVER_URL for a staging deployment.
 */
export function webhookUrl(): string {
  return process.env.VAPI_SERVER_URL?.trim() || `https://www.${appConfig.domain}/api/vapi/webhook`;
}

/** "+90 212 555 00 00", "0212 555 00 00", "0090…" → "+902125550000". Null when it isn't a number. */
export function toE164(raw: string): string | null {
  let n = raw.replace(/[\s()-]/g, "");
  if (n.startsWith("00")) n = `+${n.slice(2)}`;
  else if (n.startsWith("0")) n = `+90${n.slice(1)}`;
  else if (/^\d{10}$/.test(n)) n = `+90${n}`;
  return /^\+\d{8,15}$/.test(n) ? n : null;
}

/* ───────────────────────────── transport ───────────────────────────── */

export type VapiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

/** Vapi's validation errors come back as `message: string | string[]`. */
function errorText(body: unknown, status: number): string {
  const message = (body as { message?: unknown } | null)?.message;
  if (Array.isArray(message)) return message.join("; ");
  if (typeof message === "string") return message;
  return `HTTP ${status}`;
}

async function vapi<T>(method: "GET" | "POST" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<VapiResult<T>> {
  const key = process.env.VAPI_API_KEY?.trim();
  if (!key) return { ok: false, status: 0, error: "VAPI_API_KEY tanımlı değil." };

  try {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${key}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      // A non-JSON error page — the status code is all we can report.
    }
    if (!res.ok) return { ok: false, status: res.status, error: errorText(json, res.status) };
    return { ok: true, data: json as T };
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

/* ───────────────────────────── tools ───────────────────────────── */

/** Mirrors lib/booking/tools.ts — the names and arguments it dispatches on. */
const BOOKING_TOOLS = [
  {
    type: "function",
    function: {
      name: "check_availability",
      description:
        "Takvimdeki gerçek boş randevu saatlerini getirir. Randevu saati önermeden önce MUTLAKA çağır.",
      parameters: {
        type: "object",
        properties: {
          date: {
            type: "string",
            description: "Arayanın sorduğu gün, YYYY-MM-DD biçiminde. Belirli bir gün sorulmadıysa boş bırak.",
          },
        },
      },
    },
    // Said while the calendar loads, so the line never goes silent.
    messages: [{ type: "request-start", content: "Hemen bakıyorum." }],
  },
  {
    type: "function",
    function: {
      name: "book_appointment",
      description: "Arayanın seçtiği saate randevu oluşturur.",
      parameters: {
        type: "object",
        properties: {
          start: {
            type: "string",
            description: "check_availability'nin döndürdüğü slots dizisindeki ISO-8601 değer, aynen.",
          },
          name: { type: "string", description: "Arayanın adı soyadı." },
          email: { type: "string", description: "Arayan verdiyse e-posta adresi." },
          notes: { type: "string", description: "Kısa not: hangi hizmet için arıyor." },
        },
        required: ["start"],
      },
    },
    messages: [{ type: "request-start", content: "Hemen oluşturuyorum." }],
  },
];

/** Where the transfer tool would send the caller, or null when it can't be offered. */
export function transferTarget(agent: Agent, clinic: ClinicContext): string | null {
  if (!agent.actionIds.includes("transfer") || !clinic.transferNumber) return null;
  return toE164(clinic.transferNumber);
}

/* ───────────────────────────── tool library ───────────────────────────── */

/**
 * The tools live in Vapi's Tools library (so they show on its Tools page) and
 * assistants reference them by `model.toolIds`. Each is found by its function
 * name and rewritten on every sync, so the library never drifts from the code
 * above — edits made to them in the Vapi dashboard are overwritten.
 */
interface VapiTool {
  id: string;
  type: string;
  function?: { name?: string };
  server?: { url?: string };
}

/** One in-flight upsert per tool name, so two syncs at once can't both create it. */
const pending = new Map<string, Promise<VapiResult<string>>>();

function upsertLibraryTool(name: string, body: Record<string, unknown>): Promise<VapiResult<string>> {
  const inFlight = pending.get(name);
  if (inFlight) return inFlight;
  const run = (async (): Promise<VapiResult<string>> => {
    const list = await vapi<VapiTool[]>("GET", "/tool?limit=1000");
    if (!list.ok) return list;
    const same = list.data.filter((t) => t.type === body.type && t.function?.name === name);
    const existing = same.find((t) => t.server?.url === webhookUrl()) ?? same[0];
    const res = existing
      ? await vapi<VapiTool>("PATCH", `/tool/${encodeURIComponent(existing.id)}`, body)
      : await vapi<VapiTool>("POST", "/tool", body);
    return res.ok ? { ok: true, data: res.data.id } : res;
  })();
  pending.set(name, run);
  return run.finally(() => pending.delete(name));
}

/**
 * Shared by every clinic: the webhook finds the clinic from the call's
 * assistant id, never from the tool, so one pair serves them all.
 */
async function bookingToolIds(secret: string): Promise<VapiResult<string[]>> {
  const ids: string[] = [];
  for (const tool of BOOKING_TOOLS) {
    const res = await upsertLibraryTool(tool.function.name, {
      ...tool,
      server: { url: webhookUrl(), headers: { "x-vapi-secret": secret } },
    });
    if (!res.ok) return res;
    ids.push(res.data);
  }
  return { ok: true, data: ids };
}

/** One per clinic — the destination number is the clinic's own. */
function transferToolId(clinic: ClinicContext, number: string): Promise<VapiResult<string>> {
  const name = `transfer_${clinic.id.replace(/-/g, "").slice(0, 12)}`;
  return upsertLibraryTool(name, {
    type: "transferCall",
    function: { name, description: `Arayanı ${clinic.name} resepsiyonundaki canlı bir yetkiliye aktarır.` },
    destinations: [
      {
        type: "number",
        number,
        message: "Sizi hemen bir yetkiliye aktarıyorum, lütfen hatta kalın.",
        description: `${clinic.name} resepsiyonu`,
      },
    ],
  });
}

/** The library tools this agent should carry, created or refreshed on the way. */
async function toolIdsFor(agent: Agent, clinic: ClinicContext, secret: string): Promise<VapiResult<string[]>> {
  const ids: string[] = [];
  if (agent.actionIds.includes("book")) {
    const booking = await bookingToolIds(secret);
    if (!booking.ok) return booking;
    ids.push(...booking.data);
  }
  const transferTo = transferTarget(agent, clinic);
  if (transferTo) {
    const transfer = await transferToolId(clinic, transferTo);
    if (!transfer.ok) return transfer;
    ids.push(transfer.data);
  }
  return { ok: true, data: ids };
}

/* ───────────────────────────── assistant ───────────────────────────── */

/** The full assistant — sent whole on both create and update, so Vapi never drifts from /agents. */
export function buildAssistant(
  agent: Agent,
  clinic: ClinicContext,
  secret: string,
  toolIds: string[],
  knowledge: ClinicKnowledge | null = null,
) {
  // "{klinik}" in a greeting becomes the clinic's name, so the starter
  // greetings work for every clinic without being retyped.
  const fill = (s: string) => s.replaceAll("{klinik}", clinic.name);
  const spoken = { ...agent, greeting: { tr: fill(agent.greeting.tr), en: fill(agent.greeting.en) } };
  return {
    // Vapi caps the name at 40 characters.
    name: `${clinic.name} · ${agent.name}`.slice(0, 40),
    firstMessage: spoken.greeting.tr || spoken.greeting.en,
    model: {
      ...MODEL,
      messages: [{ role: "system", content: composeSystemPrompt(spoken, "tr", knowledge) }],
      // Emptied explicitly: assistants synced before the library held their tools inline.
      tools: [],
      toolIds,
    },
    voice: voiceFor(agent.voice),
    transcriber: TRANSCRIBER,
    server: { url: webhookUrl(), headers: { "x-vapi-secret": secret } },
    // Only the two the webhook acts on — the rest is traffic for nothing.
    serverMessages: ["tool-calls", "end-of-call-report"],
    endCallFunctionEnabled: true,
    analysisPlan: {
      // Sending an analysisPlan switches the summary off unless it's asked
      // for, and /calls and the CRM are built on it.
      summaryPlan: {
        enabled: true,
        messages: [
          {
            role: "system",
            content:
              "Bir kliniğin telefon görüşmesini 2-3 cümleyle Türkçe özetle: arayan ne istedi, ne yapıldı (randevu, aktarma, bilgi), açık kalan bir şey var mı.",
          },
          { role: "user", content: "Görüşme dökümü:\n\n{{transcript}}" },
        ],
      },
      // Read back by the webhook (extracted()) for the post-call booking net.
      structuredDataPlan: {
        enabled: true,
        schema: {
          type: "object",
          properties: {
            requestedStart: {
              type: "string",
              description: "Arayanın üzerinde anlaştığı randevu saati, ISO-8601. Anlaşılmadıysa boş.",
            },
            callerEmail: { type: "string", description: "Arayan verdiyse e-posta adresi." },
          },
        },
      },
    },
    metadata: { randevoxAgentId: agent.id, clinicId: clinic.id },
  };
}

/**
 * Creates the assistant, or updates the one this agent is already linked to.
 * An id that no longer exists in Vapi (deleted in its dashboard) is replaced
 * by a fresh assistant rather than failing forever.
 */
export async function upsertAssistant(
  agent: Agent,
  clinic: ClinicContext,
  existingId: string | null,
  knowledge: ClinicKnowledge | null = null,
): Promise<VapiResult<{ id: string; created: boolean }>> {
  const secret = webhookSecret();
  if (!secret) return { ok: false, status: 0, error: "VAPI_WEBHOOK_SECRET tanımlı değil." };
  const toolIds = await toolIdsFor(agent, clinic, secret);
  if (!toolIds.ok) return { ...toolIds, error: `Araç kütüphanesi: ${toolIds.error}` };
  const body = buildAssistant(agent, clinic, secret, toolIds.data, knowledge);

  if (existingId) {
    const updated = await vapi<{ id: string }>("PATCH", `/assistant/${encodeURIComponent(existingId)}`, body);
    if (updated.ok) return { ok: true, data: { id: updated.data.id, created: false } };
    if (updated.status !== 404) return updated;
  }

  const created = await vapi<{ id: string }>("POST", "/assistant", body);
  if (!created.ok) return created;
  return { ok: true, data: { id: created.data.id, created: true } };
}

/** Already gone counts as done. */
export async function deleteAssistant(id: string): Promise<VapiResult<null>> {
  const res = await vapi<unknown>("DELETE", `/assistant/${encodeURIComponent(id)}`);
  if (res.ok || res.status === 404) return { ok: true, data: null };
  return res;
}

/* ───────────────────────────── callback calls ───────────────────────────── */

interface VapiAssistant {
  id: string;
  model?: { messages?: { role: string; content: string }[] } & Record<string, unknown>;
}

const SOURCE_LABEL = { web: "web sitesindeki iletişim formunu", meta: "reklamdaki başvuru formunu", manual: "iletişim formunu" } as const;

/** What the agent must know on a call it placed itself — appended to its own prompt for this call only. */
function callbackBrief(name: string, note: string | null, source: keyof typeof SOURCE_LABEL): string {
  const who = name ? `${name} adlı kişi` : "Karşındaki kişi";
  const extra = note ? `\nFormdaki notu: "${note.replace(/\s+/g, " ").slice(0, 300)}"` : "";
  return `# Bu arama bir geri dönüş
Bu görüşmeyi sen başlattın, karşındaki kişi seni aramadı. ${who} kliniğin ${SOURCE_LABEL[source]} az önce doldurdu ve aranmayı kabul etti.${extra}
- Karşılama bölümündeki cümleyi bu aramada kullanma; ilk cümlen zaten söylendi.
- Önce şimdi konuşmaya uygun olup olmadığını öğren. Uygun değilse ne zaman aranmak istediğini sor, teşekkür et ve kapat.
- Uygunsa ne istediğini dinle, sorularını klinik bilgileriyle yanıtla ve uygun görürsen randevu öner.
- Israr etme. Aranmak istemediğini söylerse özür dile ve görüşmeyi kapat.
- Telesekretere düşersen kısa bir mesaj bırak: kim olduğunu ve formu için aradığını söyle.`;
}

/**
 * Phones a lead on the agent's own assistant — so the webhook recognises and
 * logs the call like any other — with the prompt and opening line swapped for
 * this call only. The model is read back from Vapi and sent whole, because an
 * override replaces it rather than merging.
 */
export async function startCallbackCall(opts: {
  assistantId: string;
  phoneNumberId: string;
  number: string;
  name: string;
  note: string | null;
  source: keyof typeof SOURCE_LABEL;
  clinic: ClinicContext;
}): Promise<VapiResult<{ id: string }>> {
  const assistant = await vapi<VapiAssistant>("GET", `/assistant/${encodeURIComponent(opts.assistantId)}`);
  if (!assistant.ok) return assistant;

  const name = opts.name.trim().slice(0, 40);
  const brief = callbackBrief(name, opts.note, opts.source);
  const model = assistant.data.model ?? {};
  const messages = model.messages ?? [];
  const withBrief = messages.some((m) => m.role === "system")
    ? messages.map((m) => (m.role === "system" ? { ...m, content: `${m.content}\n\n${brief}` } : m))
    : [{ role: "system", content: brief }, ...messages];

  return vapi<{ id: string }>("POST", "/call", {
    assistantId: opts.assistantId,
    phoneNumberId: opts.phoneNumberId,
    customer: { number: opts.number, ...(name ? { name } : {}) },
    assistantOverrides: {
      firstMessage: `Merhaba${name ? ` ${name}` : ""}, ${opts.clinic.name} olarak arıyorum. Az önce bize bir form doldurmuştunuz. Şimdi konuşmak için uygun musunuz?`,
      model: { ...model, messages: withBrief },
    },
  });
}

/* ───────────────────────────── phone numbers ───────────────────────────── */

export interface VapiPhoneNumber {
  id: string;
  name?: string;
  number?: string;
  sipUri?: string;
  provider?: string;
  assistantId?: string | null;
}

export function listPhoneNumbers(): Promise<VapiResult<VapiPhoneNumber[]>> {
  return vapi<VapiPhoneNumber[]>("GET", "/phone-number");
}

export function getPhoneNumber(id: string): Promise<VapiResult<VapiPhoneNumber>> {
  return vapi<VapiPhoneNumber>("GET", `/phone-number/${encodeURIComponent(id)}`);
}

/** Which assistant answers this number. Null detaches it — the line then rings out unanswered. */
export function assignPhoneNumber(id: string, assistantId: string | null): Promise<VapiResult<VapiPhoneNumber>> {
  return vapi<VapiPhoneNumber>("PATCH", `/phone-number/${encodeURIComponent(id)}`, { assistantId });
}

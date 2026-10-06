import { after } from "next/server";

/**
 * Error alerts to the operator's Telegram — straight from this server through
 * the Bot API, no third service in between. Same contract as lib/notify/email.ts:
 * best effort, 5 s timeout, never throws, and without TELEGRAM_BOT_TOKEN +
 * TELEGRAM_CHAT_ID it simply doesn't send (demo mode stays untouched).
 *
 * The bot token is server-only. It must never get a NEXT_PUBLIC_ prefix.
 */

const TELEGRAM_URL = "https://api.telegram.org";
const DEDUPE_MS = 5 * 60 * 1000;
const MAX_LEN = 3800; // Telegram's hard limit is 4096; leave room for the header.

/** source+message → last time it was sent. Per server instance, which is enough to kill a retry storm. */
const recent = new Map<string, number>();

export function isTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim() && process.env.TELEGRAM_CHAT_ID?.trim());
}

export interface ErrorReport {
  /** Where it happened, e.g. "vapi/webhook" or "client". */
  source: string;
  message: string;
  /** Extra one-liners (path, clinic, digest…). Never put secrets or patient data here. */
  context?: Record<string, string | number | undefined | null>;
}

function shouldSend(key: string): boolean {
  const now = Date.now();
  for (const [k, t] of recent) if (now - t > DEDUPE_MS) recent.delete(k);
  if (recent.has(key)) return false;
  recent.set(key, now);
  return true;
}

async function send(report: ErrorReport, opts: { header?: string; dedupe?: boolean } = {}): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) return;
  if (opts.dedupe !== false && !shouldSend(`${report.source}|${report.message.slice(0, 200)}`)) return;

  const env = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown";
  const lines = [
    opts.header ?? `🚨 Randevox hata (${env})`,
    `Kaynak: ${report.source}`,
    ...Object.entries(report.context ?? {})
      .filter(([, v]) => v !== undefined && v !== null && v !== "")
      .map(([k, v]) => `${k}: ${v}`),
    "",
    report.message,
  ];
  const text = lines.join("\n").slice(0, MAX_LEN);

  try {
    const res = await fetch(`${TELEGRAM_URL}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.error(`[telegram] rejected: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  } catch (e) {
    console.error("[telegram] could not reach Telegram:", e instanceof Error ? e.message : e);
  }
}

/**
 * Fire-and-forget alert for use inside request handlers. Inside a request it
 * runs via after() so the response isn't held up; anywhere else it is awaited.
 * Never throws.
 */
export async function notifyError(report: ErrorReport): Promise<void> {
  if (!isTelegramConfigured()) return;
  try {
    after(() => send(report));
  } catch {
    await send(report);
  }
}

/** Same as notifyError, but takes whatever a catch block caught. */
export function notifyCaught(source: string, err: unknown, context?: ErrorReport["context"]): Promise<void> {
  const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  return notifyError({ source, message, context });
}

/**
 * A new /demo-talep request — a sales lead, not an error, never deduped. The
 * context carries the prospect's contact details (not patient data) to the
 * operator's own private chat only.
 */
export async function notifyDemoRequest(report: ErrorReport): Promise<void> {
  if (!isTelegramConfigured()) return;
  const opts = { header: "📞 Yeni demo talebi", dedupe: false };
  try {
    after(() => send(report, opts));
  } catch {
    await send(report, opts);
  }
}

/** A message from a customer's feedback widget — not an error, and never deduped. */
export async function notifyFeedback(report: ErrorReport): Promise<void> {
  if (!isTelegramConfigured()) return;
  const opts = { header: "💬 Randevox mesaj", dedupe: false };
  try {
    after(() => send(report, opts));
  } catch {
    await send(report, opts);
  }
}

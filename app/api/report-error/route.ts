import { NextResponse } from "next/server";
import { notifyError } from "@/lib/notify/telegram";

/**
 * POST { message, source?, path?, digest? } — browser-side errors (error.tsx,
 * global-error.tsx, window.onerror) end up here and go on to Telegram.
 *
 * Public by necessity (visitors aren't signed in), so it is fenced: small
 * body, capped field lengths, and a per-IP budget. The Telegram helper also
 * dedupes identical messages, so a crash loop can't flood the chat.
 */

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, { count: number; since: number }>();

function allowed(ip: string): boolean {
  const now = Date.now();
  for (const [k, v] of hits) if (now - v.since > WINDOW_MS) hits.delete(k);
  const entry = hits.get(ip) ?? { count: 0, since: now };
  entry.count += 1;
  hits.set(ip, entry);
  return entry.count <= MAX_PER_WINDOW;
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!allowed(ip)) return NextResponse.json({ ok: false }, { status: 429 });

  const raw = await req.text();
  if (raw.length > 4000) return NextResponse.json({ ok: false }, { status: 413 });
  let body: Record<string, unknown> | null = null;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const text = (key: string, max: number) =>
    typeof body?.[key] === "string" ? (body[key] as string).slice(0, max) : "";
  const message = text("message", 1000);
  if (!message) return NextResponse.json({ ok: false }, { status: 400 });

  await notifyError({
    source: `tarayıcı${text("source", 40) ? ` (${text("source", 40)})` : ""}`,
    message,
    context: { sayfa: text("path", 200), digest: text("digest", 60) },
  });
  return NextResponse.json({ ok: true });
}

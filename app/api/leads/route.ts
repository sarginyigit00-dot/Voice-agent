import { after, NextResponse } from "next/server";
import { intakeLead, isLeadSource, processLead } from "@/lib/leads/callback";

/**
 * POST /api/leads?key=<clinic's form key> — a clinic's lead form, from its
 * own website (cross-origin, JSON or a plain HTML form) or relayed by n8n
 * from a Meta lead ad. Fields: name, phone, consent, note?, source?.
 * The call starts right after the response (lib/leads/callback.ts).
 * Setup and a ready form: n8n/HIZLI-GERI-DONUS.md.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: CORS });

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

async function readBody(req: Request): Promise<Record<string, unknown>> {
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const body = await req.json().catch(() => null);
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  }
  const form = await req.formData().catch(() => null);
  return form ? Object.fromEntries(form.entries()) : {};
}

export async function POST(req: Request) {
  const key = new URL(req.url).searchParams.get("key") ?? "";
  const body = await readBody(req);
  const text = (k: string, max: number) => (typeof body[k] === "string" ? (body[k] as string).trim().slice(0, max) : "");

  // Honeypot, same as /demo-talep: a bot that filled the hidden field gets a success and nothing happens.
  if (text("website", 200)) return json({ ok: true });

  const consent = body.consent === true || ["true", "on", "1", "yes", "evet"].includes(text("consent", 10).toLowerCase());
  const source = text("source", 20);

  const res = await intakeLead(key, {
    name: text("name", 80),
    phone: text("phone", 30),
    note: text("note", 1000) || null,
    source: isLeadSource(source) ? source : "web",
    consent,
  });
  if (!res.ok) return json({ ok: false, error: res.error }, res.status);

  const leadId = res.leadId;
  if (leadId) after(() => processLead(leadId).then(() => undefined));
  return json({ ok: true, duplicate: res.duplicate });
}

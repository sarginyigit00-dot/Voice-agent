import { after, NextResponse } from "next/server";
import { addDemoRequest, type DemoRequestInput } from "@/lib/demo-requests/queries";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[0-9 ()-]{7,20}$/;

/**
 * POST { clinicName, contactName, phone, email?, note? } — the /demo-talep
 * form. Errors come back as a field code the page turns into a message.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const text = (key: string, max: number) =>
    typeof body?.[key] === "string" ? (body[key] as string).trim().slice(0, max) : "";

  // Honeypot: a field no person can see. Whoever filled it gets a success
  // and nothing is stored.
  if (text("website", 200)) return NextResponse.json({ ok: true });

  const input: DemoRequestInput = {
    clinicName: text("clinicName", 120),
    contactName: text("contactName", 120),
    phone: text("phone", 30),
    email: text("email", 200).toLowerCase() || null,
    note: text("note", 1000) || null,
  };

  const invalid = (error: string) => NextResponse.json({ ok: false, error }, { status: 400 });
  if (input.clinicName.length < 2) return invalid("clinic_name");
  if (input.contactName.length < 2) return invalid("contact_name");
  if (!PHONE_RE.test(input.phone) || input.phone.replace(/\D/g, "").length < 7) return invalid("phone");
  if (input.email && !EMAIL_RE.test(input.email)) return invalid("email");

  const result = await addDemoRequest(input);
  if (result === "error") return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });

  // After the response, so a slow webhook never holds up the visitor.
  after(() => notify(input));
  return NextResponse.json({ ok: true });
}

/** Optional: ping n8n (Telegram, e-mail…) so a new request doesn't wait for someone to open /admin. */
async function notify(input: DemoRequestInput) {
  const url = process.env.DEMO_REQUEST_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "demo_request.created", ...input }),
      signal: AbortSignal.timeout(5_000),
    });
  } catch (err) {
    console.error("[demo-request] webhook failed:", err);
  }
}

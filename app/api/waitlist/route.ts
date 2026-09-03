import { NextResponse } from "next/server";
import { addWaitlistEmail } from "@/lib/waitlist/queries";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** POST { email } — signs an email up on the /on-kayit waitlist. */
export async function POST(req: Request) {
  let email = "";
  try {
    const body = await req.json();
    email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  } catch {
    // fall through to the validation error below
  }

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
  }

  const result = await addWaitlistEmail(email);
  if (result === "error") {
    return NextResponse.json({ ok: false, error: "insert_failed" }, { status: 500 });
  }

  // Fire-and-forget: hand the email to n8n so it can send the AI welcome
  // email. Never block or fail the signup on this — it's a nice-to-have.
  triggerWelcomeEmail(email);

  // "demo" (Supabase not configured) still reads as success to the visitor.
  return NextResponse.json({ ok: true });
}

function triggerWelcomeEmail(email: string) {
  const url = process.env.WAITLIST_WEBHOOK_URL;
  if (!url) return;

  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  }).catch((err) => console.error("[waitlist] n8n webhook failed:", err));
}

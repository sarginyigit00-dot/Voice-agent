import { NextResponse } from "next/server";
import { isAutomationRequest } from "@/lib/automation/emit";
import { sendDueOnboardingEmails } from "@/lib/onboarding/emails";

export const dynamic = "force-dynamic";

/**
 * Polled daily by the automation app (automation/app.py, `onboarding_emails`):
 * sends the day-3 and day-7 onboarding mails that are due, counted from each
 * clinic's "assistant is ready" mail (lib/onboarding/emails.ts).
 */
export async function POST(req: Request) {
  if (!isAutomationRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ ok: true, sent: await sendDueOnboardingEmails() });
}

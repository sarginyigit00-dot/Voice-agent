import { NextResponse } from "next/server";
import { isAutomationRequest } from "@/lib/automation/emit";
import { isQuotaLevel, markQuotaAlertSent, pendingQuotaAlerts } from "@/lib/clinics/quota-alerts";

export const dynamic = "force-dynamic";

/**
 * GET — clinics that crossed 80 % / 100 % of their monthly minutes and have not
 * been warned about that level yet this month. Polled daily by the automation
 * app (automation/app.py, `quota_alerts`), which sends the email.
 */
export async function GET(req: Request) {
  if (!isAutomationRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ alerts: await pendingQuotaAlerts() });
}

/** POST { clinicId, level } — the email went out; don't offer this level again this month. */
export async function POST(req: Request) {
  if (!isAutomationRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const clinicId = typeof body?.clinicId === "string" ? body.clinicId : null;
  if (!clinicId || !isQuotaLevel(body?.level)) {
    return NextResponse.json({ error: "clinicId ve level (1 | 2) gerekli." }, { status: 400 });
  }
  const ok = await markQuotaAlertSent(clinicId, body.level);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Kaydedilemedi." }, { status: 500 });
}

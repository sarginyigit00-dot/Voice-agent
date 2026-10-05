import { NextResponse } from "next/server";
import { isAutomationRequest } from "@/lib/automation/emit";
import { buildReports, isReportKind } from "@/lib/reports/stats";

export const dynamic = "force-dynamic";

/**
 * GET ?kind=weekly|monthly — the numbers behind the emailed performance
 * report. Polled by the automation app (automation/app.py, `weekly_report` and
 * `monthly_report`), which formats and sends the mail.
 */
export async function GET(req: Request) {
  if (!isAutomationRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const kind = new URL(req.url).searchParams.get("kind");
  if (!isReportKind(kind)) return NextResponse.json({ error: "kind must be weekly or monthly" }, { status: 400 });
  return NextResponse.json({ kind, reports: await buildReports(kind) });
}

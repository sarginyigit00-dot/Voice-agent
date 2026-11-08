import { NextResponse } from "next/server";
import { isAutomationRequest } from "@/lib/automation/emit";
import { processDueLeads } from "@/lib/leads/callback";

export const dynamic = "force-dynamic";

/**
 * Formerly polled by the automation app to phone waiting leads. Agents no
 * longer dial out (lib/leads/callback.ts), so this answers with nothing to do;
 * kept so an automation app still running the old job doesn't error.
 */
export async function POST(req: Request) {
  if (!isAutomationRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ ok: true, processed: await processDueLeads() });
}

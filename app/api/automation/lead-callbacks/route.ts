import { NextResponse } from "next/server";
import { isAutomationRequest } from "@/lib/automation/emit";
import { processDueLeads } from "@/lib/leads/callback";

export const dynamic = "force-dynamic";

/**
 * Polled by n8n (n8n/randevox-lead-callbacks.json): phones the leads that
 * arrived out of hours or whose call failed. Vercel's plan runs crons daily
 * at most, so the schedule lives in n8n.
 */
export async function POST(req: Request) {
  if (!isAutomationRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ ok: true, processed: await processDueLeads() });
}

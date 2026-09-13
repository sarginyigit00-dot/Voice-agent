import { NextResponse } from "next/server";
import { requireMember } from "@/lib/clinics/server";
import { removeAgent, syncAgentToVapi } from "@/lib/vapi/sync";

export const dynamic = "force-dynamic";

/**
 * POST { agentId, action?: "delete" } — called by /agents right after an
 * agent is saved (or deleted) in Supabase, to mirror it onto its Vapi
 * assistant. The row is re-read here from the database, scoped to the
 * caller's clinic — nothing about the agent is taken from the request body.
 *
 * Failures come back as 200 with `ok: false`: the save itself already
 * succeeded, and the page shows the message next to the save button.
 */
export async function POST(req: Request) {
  const member = await requireMember(req);
  if (!member.ok) return NextResponse.json({ ok: false, message: member.error }, { status: member.status });

  const body = (await req.json().catch(() => null)) as { agentId?: unknown; action?: unknown } | null;
  const agentId = typeof body?.agentId === "string" ? body.agentId : "";
  if (!agentId) return NextResponse.json({ ok: false, message: "agentId gerekli." }, { status: 400 });

  const result =
    body?.action === "delete"
      ? await removeAgent(agentId, member.clinic)
      : await syncAgentToVapi(agentId, member.clinic);
  return NextResponse.json(result);
}

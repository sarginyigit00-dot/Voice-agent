import { NextResponse } from "next/server";
import { requireMember } from "@/lib/clinics/server";
import { getKnowledge, saveKnowledge } from "@/lib/clinics/knowledge";
import { normalizeKnowledge } from "@/lib/clinics/knowledge-shape";
import { syncClinicAgents } from "@/lib/vapi/sync";
import { isVapiConfigured } from "@/lib/vapi/client";

export const dynamic = "force-dynamic";

/**
 * /klinik's backend. The clinic is always the caller's own (requireMember) —
 * this route holds the service-role key, so an id from the body is never used.
 * Saving re-pushes every Vapi-linked agent, because the facts live in each
 * assistant's system prompt and would otherwise go stale until the next edit.
 */

export async function GET(req: Request) {
  const member = await requireMember(req);
  if (!member.ok) return NextResponse.json({ error: member.error }, { status: member.status });
  return NextResponse.json({ knowledge: await getKnowledge(member.clinic.id) });
}

export async function PUT(req: Request) {
  const member = await requireMember(req);
  if (!member.ok) return NextResponse.json({ error: member.error }, { status: member.status });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.knowledge !== "object") {
    return NextResponse.json({ error: "Klinik bilgileri eksik." }, { status: 400 });
  }

  const knowledge = normalizeKnowledge(body.knowledge);
  const saved = await saveKnowledge(member.clinic.id, knowledge, member.user.id);
  if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: 500 });

  const results = isVapiConfigured() ? await syncClinicAgents(member.clinic) : [];
  return NextResponse.json({
    ok: true,
    knowledge,
    synced: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).map((r) => ({ name: r.name, message: r.message })),
  });
}

import { NextResponse } from "next/server";
import { requireMember } from "@/lib/clinics/server";
import { voiceFor, voicePreviewUrl } from "@/lib/vapi/client";

export const dynamic = "force-dynamic";

/**
 * GET ?label=<persona label> → { voiceId, url } — the sample behind the
 * /agents "Sesi önizle" button. The label is resolved exactly as a sync
 * resolves it (voiceFor), so the preview is the voice the phone line will use.
 */
export async function GET(req: Request) {
  const member = await requireMember(req);
  if (!member.ok) return NextResponse.json({ error: member.error }, { status: member.status });

  const label = new URL(req.url).searchParams.get("label") ?? "";
  const { voiceId } = voiceFor(label);
  const preview = await voicePreviewUrl(voiceId);
  if (!preview.ok) return NextResponse.json({ error: `Vapi: ${preview.error}` }, { status: 502 });
  if (!preview.data) return NextResponse.json({ error: "Bu ses için örnek yok.", voiceId }, { status: 404 });

  return NextResponse.json({ voiceId, url: preview.data }, { headers: { "Cache-Control": "no-store" } });
}

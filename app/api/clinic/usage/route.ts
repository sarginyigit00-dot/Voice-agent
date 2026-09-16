import { NextResponse } from "next/server";
import { requireMember } from "@/lib/clinics/server";
import { usageFor } from "@/lib/clinics/usage";

export const dynamic = "force-dynamic";

/** The dashboard's minutes meter — always the caller's own clinic (requireMember), never an id from the request. */
export async function GET(req: Request) {
  const member = await requireMember(req);
  if (!member.ok) return NextResponse.json({ error: member.error }, { status: member.status });

  const usage = await usageFor(member.clinic.id);
  if (!usage) return NextResponse.json({ error: "Kullanım okunamadı." }, { status: 500 });
  return NextResponse.json({ usage });
}

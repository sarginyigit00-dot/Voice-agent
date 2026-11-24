import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { parseKnowledgeText } from "@/lib/demo/trials";
import { createTrial, deleteTrial, listTrials } from "@/lib/demo/trials-server";
import { isEmptyKnowledge } from "@/lib/clinics/knowledge-shape";

export const dynamic = "force-dynamic";
// Creating a trial provisions a Vapi assistant (tool library + assistant).
export const maxDuration = 60;

/** GET → every clinic trial with its usage, for /admin → Denemeler. */
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  return NextResponse.json({ trials: await listTrials() });
}

/**
 * POST { action: "create", clinicName, demoRequestId?, services, doctors, faq }
 * POST { action: "delete", id }
 * Same cookie gate as the rest of /admin.
 */
export async function POST(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const str = (k: string, max: number) => (typeof body?.[k] === "string" ? (body[k] as string).trim().slice(0, max) : "");

  if (body?.action === "delete") {
    const id = str("id", 64);
    if (!id) return NextResponse.json({ ok: false, message: "Geçersiz istek." }, { status: 400 });
    const res = await deleteTrial(id);
    return res.ok
      ? NextResponse.json({ ok: true, message: "Deneme silindi, asistanı Vapi'den kaldırıldı." })
      : NextResponse.json({ ok: false, message: res.error }, { status: 400 });
  }

  if (body?.action !== "create") return NextResponse.json({ ok: false, message: "Geçersiz istek." }, { status: 400 });

  const clinicName = str("clinicName", 80);
  if (clinicName.length < 2) return NextResponse.json({ ok: false, message: "Klinik adı gerekli." }, { status: 400 });
  const knowledge = parseKnowledgeText({
    services: str("services", 20_000),
    doctors: str("doctors", 10_000),
    address: "",
    faq: str("faq", 4000),
  });
  if (isEmptyKnowledge(knowledge)) {
    return NextResponse.json({ ok: false, message: "En az bir hizmet ya da adres girin; asistan kliniği tanımalı." }, { status: 400 });
  }
  const demoRequestId = /^[0-9a-f-]{36}$/i.test(str("demoRequestId", 64)) ? str("demoRequestId", 64) : null;

  const res = await createTrial({ clinicName, knowledge, demoRequestId });
  if (!res.ok) return NextResponse.json({ ok: false, message: res.error }, { status: 400 });
  return NextResponse.json({ ok: true, message: "Deneme oluşturuldu.", code: res.data.code });
}

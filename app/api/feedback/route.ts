import { NextResponse } from "next/server";
import { requireMember } from "@/lib/clinics/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { notifyFeedback } from "@/lib/notify/telegram";

export const dynamic = "force-dynamic";

/**
 * POST multipart { category, message, file?, path? } — the cockpit's
 * "Geliştiriciye mesaj gönder" widget. Members only; the clinic comes from the
 * token, never from the body. The attachment goes to a private bucket.
 */

const CATEGORIES = ["fikir", "hata", "soru", "diger"] as const;
const MAX_MESSAGE = 2000;
const MAX_FILE = 4 * 1024 * 1024; // Vercel's request body cap is ~4.5 MB.
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf", "text/plain"];

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 8;
const hits = new Map<string, { count: number; since: number }>();

function allowed(key: string): boolean {
  const now = Date.now();
  for (const [k, v] of hits) if (now - v.since > WINDOW_MS) hits.delete(k);
  const entry = hits.get(key) ?? { count: 0, since: now };
  entry.count += 1;
  hits.set(key, entry);
  return entry.count <= MAX_PER_WINDOW;
}

export async function POST(req: Request) {
  const member = await requireMember(req);
  if (!member.ok) return NextResponse.json({ ok: false, message: member.error }, { status: member.status });
  if (!allowed(member.user.id)) {
    return NextResponse.json(
      { ok: false, message: "Çok fazla mesaj gönderdiniz, biraz sonra tekrar deneyin." },
      { status: 429 },
    );
  }

  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ ok: false, message: "Şu an mesaj alınamıyor." }, { status: 503 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ ok: false, message: "Geçersiz istek." }, { status: 400 });

  const category = String(form.get("category") ?? "");
  const message = String(form.get("message") ?? "").trim().slice(0, MAX_MESSAGE);
  const pagePath = String(form.get("path") ?? "").slice(0, 200);
  if (!(CATEGORIES as readonly string[]).includes(category) || !message) {
    return NextResponse.json({ ok: false, message: "Lütfen bir mesaj yazın." }, { status: 400 });
  }

  let attachmentPath: string | null = null;
  let attachmentName: string | null = null;
  const file = form.get("file");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_FILE) {
      return NextResponse.json({ ok: false, message: "Dosya 4 MB'tan büyük olamaz." }, { status: 413 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { ok: false, message: "Yalnızca görsel, PDF veya metin dosyası eklenebilir." },
        { status: 415 },
      );
    }
    const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-80) || "dosya";
    const path = `${member.clinic.id}/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage
      .from("feedback-attachments")
      .upload(path, await file.arrayBuffer(), { contentType: file.type });
    if (error) {
      console.error("[feedback] upload failed:", error.message);
      return NextResponse.json({ ok: false, message: "Dosya yüklenemedi." }, { status: 500 });
    }
    attachmentPath = path;
    attachmentName = file.name.slice(0, 120);
  }

  const { error } = await supabase.from("feedback").insert({
    clinic_id: member.clinic.id,
    user_id: member.user.id,
    user_email: member.user.email ?? null,
    category,
    message,
    attachment_path: attachmentPath,
    attachment_name: attachmentName,
    page_path: pagePath || null,
    user_agent: (req.headers.get("user-agent") ?? "").slice(0, 300),
  });
  if (error) {
    console.error("[feedback] insert failed:", error.message);
    return NextResponse.json({ ok: false, message: "Mesaj kaydedilemedi." }, { status: 500 });
  }

  await notifyFeedback({
    source: category,
    message,
    context: {
      klinik: member.clinic.name,
      kullanıcı: member.user.email,
      sayfa: pagePath,
      ek: attachmentName,
    },
  });
  return NextResponse.json({ ok: true, message: "Mesajınız iletildi, teşekkürler!" });
}

import { NextResponse } from "next/server";
import { runRetention } from "@/lib/privacy/retention";
import { notifyError } from "@/lib/notify/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Nightly retention run (see vercel.json for the schedule and
 * lib/privacy/retention.ts for the periods). Same CRON_SECRET gate as
 * crm-sync: it deletes data, so it must never run for whoever finds the URL.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runRetention();
  if (result.errors.length) {
    await notifyError({
      source: "cron/retention",
      message: `Saklama süresi temizliğinde ${result.errors.length} hata: ${result.errors.slice(0, 3).join(" | ")}`,
    });
  }
  return NextResponse.json(result, { status: result.status === "partial" ? 500 : 200 });
}

import { NextResponse } from "next/server";
import { syncCallsToCrm } from "@/lib/crm/sync";

export const dynamic = "force-dynamic";

/**
 * Periodic `calls` → `crm_records` backfill (see vercel.json for the schedule).
 * Requires CRON_SECRET — Vercel Cron sends `Authorization: Bearer <secret>`
 * automatically once the env var is set on the project.
 *
 * Fails closed: without CRON_SECRET configured, this used to run for anyone
 * who requested the URL. It's read-mostly (an idempotent upsert), so the
 * blast radius of that was DB load rather than data loss, but "runs
 * unauthenticated by default" is the wrong default regardless — set
 * CRON_SECRET before deploying, or the sync simply stays off.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await syncCallsToCrm();
  return NextResponse.json(result, { status: result.status === "error" ? 500 : 200 });
}

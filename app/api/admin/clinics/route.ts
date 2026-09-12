import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { runClinicAction } from "@/lib/admin/clinics";

export const dynamic = "force-dynamic";

/**
 * POST { action, … } — the /admin "Klinikler" tab's write endpoint.
 *
 * Same signed-cookie gate as every admin route, and for the same reason: it
 * holds the service-role key — and here it also writes each clinic's calendar
 * credentials and creates staff accounts.
 */
export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const result = await runClinicAction(body);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}

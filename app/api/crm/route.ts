import { NextResponse } from "next/server";
import { listCrmRecords } from "@/lib/crm/queries";
import { requireMember } from "@/lib/clinics/server";

const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 1000;

/**
 * Backs the /crm page — returns the internal CRM log (newest first).
 * The page groups these rows into contacts client-side, so the window has to
 * be wide enough that a contact's older calls aren't silently cut off.
 *
 * Requires a signed-in Supabase session: `listCrmRecords` reads with the
 * service-role key, which bypasses RLS, so this route is the only thing
 * standing between the public internet and every caller's name, phone number
 * and full transcript. Without this check it was exactly that.
 */
export async function GET(request: Request) {
  const member = await requireMember(request);
  if (!member.ok) return NextResponse.json({ error: member.error }, { status: member.status });

  const raw = Number(new URL(request.url).searchParams.get("limit"));
  const limit = Number.isFinite(raw) && raw > 0 ? Math.min(Math.trunc(raw), MAX_LIMIT) : DEFAULT_LIMIT;

  const records = await listCrmRecords(member.clinic.id, limit);
  return NextResponse.json({ records });
}

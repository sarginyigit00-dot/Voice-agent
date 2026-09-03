import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { runAdminAction, type AdminAction } from "@/lib/admin/actions";

export const dynamic = "force-dynamic";

const ALLOWED: AdminAction[] = ["ban", "unban", "confirm", "setPassword", "delete"];

/**
 * POST { action, userId } — the /admin panel's write endpoint.
 *
 * Gated by the same signed cookie as the page. The page's own check isn't
 * enough: this route holds the service-role key, so it has to verify for
 * itself rather than trust that whoever calls it came from the panel.
 */
export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  let action: string | undefined;
  let userId: string | undefined;
  let password: string | undefined;
  try {
    const body = (await request.json()) as {
      action?: unknown;
      userId?: unknown;
      password?: unknown;
    };
    action = typeof body.action === "string" ? body.action : undefined;
    userId = typeof body.userId === "string" ? body.userId : undefined;
    password = typeof body.password === "string" ? body.password : undefined;
  } catch {
    // Falls through to the validation error below.
  }

  if (!action || !ALLOWED.includes(action as AdminAction) || !userId) {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  // runAdminAction enforces the length rule; this only keeps a password from
  // riding along on an action that has no business carrying one.
  const result = await runAdminAction(
    action as AdminAction,
    userId,
    action === "setPassword" ? password : undefined,
  );
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}

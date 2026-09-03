import { NextResponse } from "next/server";
import { calcomConfig, getSlots, speakInstant } from "@/lib/calcom/client";
import { requireUser } from "@/lib/auth/require-user";

/**
 * Real open slots for the /randevular reschedule picker — the panel
 * equivalent of what lib/booking/tools.ts's check_availability offers the
 * voice agent mid-call. Staff pick from what Cal.com actually has open
 * rather than guessing a time and finding out it's taken on submit.
 */
export async function GET(req: Request) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });

  const cfg = calcomConfig();
  if (!cfg) return NextResponse.json({ error: "Cal.com yapılandırılmamış." }, { status: 503 });

  const days = Math.min(Number(new URL(req.url).searchParams.get("days")) || 7, 30);
  const slots = await getSlots(cfg, { start: new Date(), end: new Date(Date.now() + days * 24 * 60 * 60 * 1000) });

  if (!slots.ok) return NextResponse.json({ error: slots.error }, { status: 502 });

  const upcoming = slots.data.filter((s) => Date.parse(s) > Date.now());
  return NextResponse.json({
    slots: upcoming.map((s) => ({ start: s, spoken: speakInstant(new Date(s), cfg.timeZone) })),
  });
}

import { NextResponse } from "next/server";
import { calcomConfigFor, getSlots, speakInstant } from "@/lib/calcom/client";
import { requireMember } from "@/lib/clinics/server";
import { resolveDoctor } from "@/lib/booking/doctors";

/**
 * Real open slots for the /randevular reschedule picker — the panel
 * equivalent of what lib/booking/tools.ts's check_availability offers the
 * voice agent mid-call. Staff pick from what Cal.com actually has open
 * rather than guessing a time and finding out it's taken on submit.
 */
export async function GET(req: Request) {
  const member = await requireMember(req);
  if (!member.ok) return NextResponse.json({ error: member.error }, { status: member.status });

  const baseCfg = await calcomConfigFor(member.clinic);
  if (!baseCfg) return NextResponse.json({ error: "Cal.com yapılandırılmamış." }, { status: 503 });

  const params = new URL(req.url).searchParams;
  // ?doctor= reads that doctor's own calendar when they have one.
  const { cfg } = await resolveDoctor(member.clinic, params.get("doctor")?.trim() || null, baseCfg);

  const days = Math.min(Number(params.get("days")) || 7, 30);
  const slots = await getSlots(cfg, { start: new Date(), end: new Date(Date.now() + days * 24 * 60 * 60 * 1000) });

  if (!slots.ok) return NextResponse.json({ error: slots.error }, { status: 502 });

  const upcoming = slots.data.filter((s) => Date.parse(s) > Date.now());
  return NextResponse.json({
    slots: upcoming.map((s) => ({ start: s, spoken: speakInstant(new Date(s), cfg.timeZone) })),
  });
}

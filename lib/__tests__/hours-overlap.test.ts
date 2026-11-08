import { describe, expect, it } from "vitest";
import { defaultWorkingHours, findOverlap, type WorkingHours } from "@/lib/agents/hours";
import { STARTER_AGENTS } from "@/lib/agents/starter";
import { AGENTS } from "@/lib/demo/data";
import { conflictFor } from "@/lib/agents/conflict";

const night = STARTER_AGENTS.find((a) => a.name === "Mesai Dışı")!.workingHours;

describe("findOverlap", () => {
  it("flags two default (09–18) schedules", () => {
    expect(findOverlap(defaultWorkingHours(), defaultWorkingHours())).toEqual({ day: "mon", from: "09:00", to: "18:00" });
  });

  it("lets the day line and the after-hours line coexist (18:00 end = 18:00 start)", () => {
    expect(findOverlap(defaultWorkingHours(), night)).toBeNull();
  });

  it("reports the exact clash when hours are pulled into each other", () => {
    const early: WorkingHours = { ...night, days: { ...night.days, mon: { open: "17:00", close: "23:59", closed: false } } };
    expect(findOverlap(defaultWorkingHours(), early)).toEqual({ day: "mon", from: "17:00", to: "18:00" });
  });

  it("ignores closed days", () => {
    const sundayOnly = defaultWorkingHours();
    for (const d of Object.keys(sundayOnly.days) as (keyof typeof sundayOnly.days)[]) sundayOnly.days[d].closed = d !== "sun";
    expect(findOverlap(defaultWorkingHours(), sundayOnly)).toBeNull();
  });
});

describe("seeded agents", () => {
  it.each([
    ["starter", STARTER_AGENTS],
    ["demo", AGENTS],
  ])("%s list has no two active agents on the same hours", (_, list) => {
    for (const a of list.filter((x) => x.active)) expect(conflictFor(a, list)).toBeNull();
  });
});

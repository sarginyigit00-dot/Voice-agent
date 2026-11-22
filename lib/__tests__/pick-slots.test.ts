import { describe, expect, it } from "vitest";
import { pickSlots } from "@/lib/booking/tools";

const TZ = "Europe/Istanbul";
// 09:00 … 17:30 every half hour, 2026-11-23 (Istanbul = UTC+3).
const day = Array.from({ length: 18 }, (_, i) => {
  const m = 9 * 60 + i * 30;
  return `2026-11-23T${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}:00.000+03:00`;
});
const hour = (iso: string) => iso.slice(11, 16);

describe("pickSlots", () => {
  it("spreads a single day across morning and afternoon", () => {
    const { offered } = pickSlots(day, { singleDay: true, timeZone: TZ });
    expect(offered.map(hour)).toEqual(["09:00", "12:00", "14:30", "17:30"]);
  });

  it("keeps the earliest openings when no day was asked", () => {
    const { offered } = pickSlots(day, { singleDay: false, timeZone: TZ });
    expect(offered.map(hour)).toEqual(["09:00", "09:30", "10:00", "10:30"]);
  });

  it("only offers afternoon slots for an afternoon request", () => {
    const { offered, outsideWindow } = pickSlots(day, { from: "12:00", singleDay: true, timeZone: TZ });
    expect(outsideWindow).toBe(false);
    expect(offered.every((s) => hour(s) >= "12:00")).toBe(true);
    expect(offered).toHaveLength(4);
  });

  it("honours an upper bound", () => {
    const { offered } = pickSlots(day, { to: "11:00", singleDay: true, timeZone: TZ });
    expect(offered.map(hour)).toEqual(["09:00", "09:30", "10:00", "10:30"]);
  });

  it("falls back to the whole day and flags it when the window is full", () => {
    const { offered, outsideWindow } = pickSlots(day, { from: "19:00", singleDay: true, timeZone: TZ });
    expect(outsideWindow).toBe(true);
    expect(offered).toHaveLength(4);
  });

  it("ignores a malformed time", () => {
    const { outsideWindow, offered } = pickSlots(day, { from: "öğleden sonra", singleDay: true, timeZone: TZ });
    expect(outsideWindow).toBe(false);
    expect(offered[0]).toBe(day[0]);
  });
});

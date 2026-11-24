import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({ getSupabaseBrowser: () => null }));
vi.mock("@/lib/supabase/authed-fetch", () => ({ authedFetch: vi.fn() }));

import { istanbulDayStart } from "@/lib/agents/queries";

describe("istanbulDayStart", () => {
  it("is Istanbul midnight, as a UTC instant", () => {
    expect(istanbulDayStart(new Date("2026-11-24T15:00:00Z"))).toBe("2026-11-23T21:00:00.000Z");
  });
  it("rolls over at Istanbul midnight, not UTC's", () => {
    // 22:30 UTC is already 01:30 the next day in Istanbul.
    expect(istanbulDayStart(new Date("2026-11-24T22:30:00Z"))).toBe("2026-11-24T21:00:00.000Z");
  });
});

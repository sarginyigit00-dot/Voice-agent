import { describe, expect, it } from "vitest";
import { clientIp, rateLimit } from "@/lib/rate-limit";

describe("rateLimit", () => {
  it("allows up to max then blocks", () => {
    const key = `t-${Math.random()}`;
    expect([1, 2, 3].map(() => rateLimit(key, 3, 60_000))).toEqual([true, true, true]);
    expect(rateLimit(key, 3, 60_000)).toBe(false);
  });

  it("keeps keys independent", () => {
    const a = `a-${Math.random()}`;
    rateLimit(a, 1, 60_000);
    expect(rateLimit(a, 1, 60_000)).toBe(false);
    expect(rateLimit(`b-${Math.random()}`, 1, 60_000)).toBe(true);
  });
});

describe("clientIp", () => {
  it("takes the last forwarded hop", () => {
    const req = new Request("http://x", { headers: { "x-forwarded-for": "1.1.1.1, 2.2.2.2" } });
    expect(clientIp(req)).toBe("2.2.2.2");
  });
});

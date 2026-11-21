import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const claim = vi.fn();
const createCall = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServer: () => null }));
vi.mock("next/server", () => ({
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }) },
}));
const trialByCode = vi.fn();
vi.mock("@/lib/demo/trials-server", () => ({ trialByCode: (...a: unknown[]) => trialByCode(...a) }));
vi.mock("@/lib/demo/try-call-server", async (orig) => ({
  ...(await orig<typeof import("@/lib/demo/try-call-server")>()),
  claimDemoCall: (...a: unknown[]) => claim(...a),
  createWebCall: (...a: unknown[]) => createCall(...a),
  publicCallsLeft: async () => 2,
}));

import { demoToolResult, freeTimesOn, isDemoAssistant } from "@/lib/demo/try-call";
import { hashIp, signDemoToken } from "@/lib/demo/try-call-server";
import { POST } from "@/app/api/try-call/route";
import { parseKnowledgeText, trialStatus } from "@/lib/demo/trials";

// Wednesday 2026-11-18, 09:00 Istanbul.
const NOW = new Date("2026-11-18T06:00:00Z");
const parse = (s: string) => JSON.parse(s) as { ok: boolean; slots?: string[]; spoken?: string | string[]; closed?: boolean };

describe("demo tool answers", () => {
  it("offers future slots, spoken as words", () => {
    const r = parse(demoToolResult("check_availability", {}, NOW));
    expect(r.ok).toBe(true);
    expect(r.slots!.length).toBe(3);
    for (const s of r.slots!) expect(Date.parse(s)).toBeGreaterThan(NOW.getTime());
    for (const s of r.spoken as string[]) expect(s).not.toMatch(/\d/);
  });

  it("says Sunday is closed", () => {
    const r = parse(demoToolResult("check_availability", { date: "2026-11-22" }, NOW));
    expect(r.ok).toBe(false);
    expect(r.closed).toBe(true);
  });

  it("keeps Saturday inside its short hours", () => {
    const r = parse(demoToolResult("check_availability", { date: "2026-11-21" }, NOW));
    for (const s of r.slots!) expect(new Date(s).getUTCHours() + 3).toBeLessThan(14);
  });

  it("refuses a past date", () => {
    expect(parse(demoToolResult("check_availability", { date: "2026-11-01" }, NOW)).ok).toBe(false);
  });

  it("'books' without writing anything", () => {
    const r = parse(demoToolResult("book_appointment", { start: "2026-11-19T07:00:00.000Z" }, NOW));
    expect(r.ok).toBe(true);
    expect(r.spoken).toContain("oluşturdum");
    expect(parse(demoToolResult("book_appointment", { start: "yarın" }, NOW)).ok).toBe(false);
  });

  it("answers unknown tools explicitly", () => {
    expect(parse(demoToolResult("nope", {}, NOW)).ok).toBe(false);
  });
});

describe("demo free times", () => {
  it("change from day to day but stay the same within a day", () => {
    const week = ["2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27"].map((d) => freeTimesOn(d).join());
    expect(new Set(week).size).toBeGreaterThan(3);
    expect(freeTimesOn("2026-11-24")).toEqual(freeTimesOn("2026-11-24"));
  });
  it("keep Saturday before two", () => {
    for (const t of freeTimesOn("2026-11-28")) expect(t < "14:00" && t >= "10:00").toBe(true);
  });
});

describe("demo call token (server-side only)", () => {
  it("is an HS256 JWT signed with the private key, locked to one assistant and origin", () => {
    const token = signDemoToken({ orgId: "org", privateKey: "priv", assistantId: "asst", origins: ["https://x.com"], now: 1_000_000 });
    const [h, p, sig] = token.split(".");
    expect(createHmac("sha256", "priv").update(`${h}.${p}`).digest("base64url")).toBe(sig);
    const payload = JSON.parse(Buffer.from(p, "base64url").toString());
    expect(payload.exp - payload.iat).toBe(60);
    expect(payload.token.restrictions.allowedAssistantIds).toEqual(["asst"]);
    expect(payload.token.restrictions.allowedOrigins).toEqual(["https://x.com"]);
  });
});

describe("demo IP hash", () => {
  it("hashes IPs one-way", () => {
    expect(hashIp("1.2.3.4")).toMatch(/^[0-9a-f]{64}$/);
    expect(hashIp("1.2.3.4")).not.toContain("1.2.3.4");
  });
});

describe("POST /api/try-call", () => {
  const env = { ...process.env };
  let n = 0;
  const req = (body: unknown = {}, ip = `10.0.0.${++n}`) =>
    POST(new Request("http://x", { method: "POST", headers: { "x-forwarded-for": ip }, body: JSON.stringify(body) })) as unknown as Promise<{
      status: number;
      body: { ok: boolean; error?: string; call?: { webCallUrl: string }; left?: number | null };
    }>;

  beforeEach(() => {
    Object.assign(process.env, {
      DEMO_CALL_ENABLED: "true",
      VAPI_API_KEY: "priv",
      VAPI_ORG_ID: "org",
      VAPI_DEMO_ASSISTANT_ID: "asst",
    });
    claim.mockResolvedValue({ result: "ok", left: 2 });
    createCall.mockResolvedValue({ id: "call-1", webCallUrl: "https://room" });
  });
  afterEach(() => {
    process.env = { ...env };
    claim.mockReset();
    createCall.mockReset();
  });

  it("is off unless switched on", async () => {
    process.env.DEMO_CALL_ENABLED = "";
    expect((await req()).status).toBe(503);
    expect(claim).not.toHaveBeenCalled();
  });

  it("drops bots that fill the honeypot", async () => {
    expect((await req({ website: "spam" })).status).toBe(503);
    expect(claim).not.toHaveBeenCalled();
  });

  it("starts the call on the server and returns only the room", async () => {
    const r = await req();
    expect(r.status).toBe(200);
    expect(r.body.call!.webCallUrl).toBe("https://room");
    expect(r.body.left).toBe(2);
    expect(createCall).toHaveBeenCalledWith("asst", "female");
    expect(JSON.stringify(r.body)).not.toContain("priv");
  });

  it("passes the chosen voice, nothing else from the visitor", async () => {
    await req({ voice: "male", assistantOverrides: { maxDurationSeconds: 3000 } });
    expect(createCall).toHaveBeenCalledWith("asst", "male");
  });

  it("stops a visitor at their durable daily limit", async () => {
    claim.mockResolvedValue({ result: "ip_limit", left: 0 });
    const r = await req();
    expect(r.status).toBe(429);
    expect(r.body.error).toBe("rate_limited");
    expect(createCall).not.toHaveBeenCalled();
  });

  it("limits one visitor to three calls a day", async () => {
    const ip = "10.9.9.9";
    for (let i = 0; i < 3; i++) expect((await req({}, ip)).status).toBe(200);
    const fourth = await req({}, ip);
    expect(fourth.status).toBe(429);
    expect(fourth.body.error).toBe("rate_limited");
  });

  it("stops at the daily cap", async () => {
    claim.mockResolvedValue({ result: "cap" });
    const r = await req();
    expect(r.status).toBe(429);
    expect(r.body.error).toBe("daily_cap");
  });

  it("fails closed when the cap can't be checked", async () => {
    claim.mockResolvedValue({ result: "error" });
    expect((await req()).status).toBe(500);
  });
});

describe("isDemoAssistant", () => {
  afterEach(() => delete process.env.VAPI_DEMO_ASSISTANT_ID);
  it("matches only the configured id", () => {
    expect(isDemoAssistant("asst")).toBe(false);
    process.env.VAPI_DEMO_ASSISTANT_ID = "asst";
    expect(isDemoAssistant("asst")).toBe(true);
    expect(isDemoAssistant("other")).toBe(false);
    expect(isDemoAssistant(undefined)).toBe(false);
  });
});

describe("clinic trial rules", () => {
  const t = { expiresAt: "2026-12-02T06:00:00Z", maxCalls: 15 };
  it("counts down calls and days", () => {
    expect(trialStatus(t, 4, NOW)).toEqual({ active: true, reason: "ok", callsLeft: 11, daysLeft: 14 });
  });
  it("ends when the calls run out", () => {
    expect(trialStatus(t, 15, NOW)).toMatchObject({ active: false, reason: "used_up", callsLeft: 0 });
  });
  it("ends on the date", () => {
    expect(trialStatus(t, 0, new Date("2026-12-02T06:00:01Z"))).toMatchObject({ active: false, reason: "expired" });
  });
  it("reads the operator's plain lines", () => {
    const k = parseKnowledgeText({
      services: "Diş taşı temizliği | 1.500 TL | 30 dk\nİmplant | | 60 | Fiyat muayeneden sonra\n\n",
      doctors: "Dt. Ayşe Yılmaz | Ortodonti\nMehmet Kaya",
      address: " Bağdat Cad. 1 ",
      faq: "",
    });
    expect(k.services).toEqual([
      { name: "Diş taşı temizliği", specialty: "", price: 1500, durationMin: 30, description: "" },
      { name: "İmplant", specialty: "", price: null, durationMin: 60, description: "Fiyat muayeneden sonra" },
    ]);
    expect(k.doctors[0]).toMatchObject({ title: "Dt.", name: "Ayşe Yılmaz", specialty: "Ortodonti" });
    expect(k.doctors[1]).toMatchObject({ title: "", name: "Mehmet Kaya" });
    expect(k.address).toBe("Bağdat Cad. 1");
  });
});

describe("POST /api/try-call with a trial code", () => {
  const env = { ...process.env };
  const trial = (status: object) => ({ id: "trial-1", vapiAssistantId: "trial-asst", status: { active: true, reason: "ok", callsLeft: 15, ...status } });
  const req = (ip: string) =>
    POST(new Request("http://x", { method: "POST", headers: { "x-forwarded-for": ip }, body: JSON.stringify({ code: "abcdefgh23" }) })) as unknown as Promise<{
      status: number;
      body: { ok: boolean; error?: string; left?: number | null };
    }>;

  beforeEach(() => {
    // The public demo's assistant isn't needed for a trial.
    Object.assign(process.env, { DEMO_CALL_ENABLED: "true", VAPI_API_KEY: "priv", VAPI_ORG_ID: "org", VAPI_DEMO_ASSISTANT_ID: "" });
    claim.mockResolvedValue({ result: "ok" });
    createCall.mockResolvedValue({ id: "call-1", webCallUrl: "https://room" });
  });
  afterEach(() => {
    process.env = { ...env };
    claim.mockReset();
    trialByCode.mockReset();
    createCall.mockReset();
  });

  it("starts a call on the trial's own assistant and counts it down", async () => {
    trialByCode.mockResolvedValue(trial({ callsLeft: 4 }));
    const r = await req("10.1.0.1");
    expect(createCall).toHaveBeenCalledWith("trial-asst", "female");
    expect(claim).toHaveBeenCalledWith("10.1.0.1", "trial-1");
    expect(r.body.left).toBe(3);
  });

  it("refuses an unknown, expired or used-up trial", async () => {
    trialByCode.mockResolvedValue(null);
    expect((await req("10.1.0.2")).status).toBe(404);
    trialByCode.mockResolvedValue(trial({ active: false, reason: "expired" }));
    expect((await req("10.1.0.3")).body.error).toBe("expired");
    trialByCode.mockResolvedValue(trial({ active: false, reason: "used_up" }));
    expect((await req("10.1.0.4")).body.error).toBe("used_up");
    expect(claim).not.toHaveBeenCalled();
  });

  it("passes on the trial's daily limit", async () => {
    trialByCode.mockResolvedValue(trial({}));
    claim.mockResolvedValue({ result: "trial_daily" });
    const r = await req("10.1.0.5");
    expect(r.status).toBe(429);
    expect(r.body.error).toBe("trial_daily");
  });
});

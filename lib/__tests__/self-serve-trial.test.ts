import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ getSupabaseServer: () => null }));
vi.mock("next/server", () => ({
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }) },
  after: (fn: () => unknown) => fn(),
}));

const trialByEmail = vi.fn();
const selfServeCounts = vi.fn();
const createTrial = vi.fn();
const deleteTrial = vi.fn();
const addDemoRequest = vi.fn();
const sendMail = vi.fn();
const notify = vi.fn();
vi.mock("@/lib/demo/trials-server", () => ({
  trialByEmail: (...a: unknown[]) => trialByEmail(...a),
  selfServeCounts: (...a: unknown[]) => selfServeCounts(...a),
  createTrial: (...a: unknown[]) => createTrial(...a),
  deleteTrial: (...a: unknown[]) => deleteTrial(...a),
}));
vi.mock("@/lib/demo-requests/queries", () => ({ addDemoRequestReturningId: (...a: unknown[]) => addDemoRequest(...a) }));
vi.mock("@/lib/notify/email", async (orig) => ({
  ...(await orig<typeof import("@/lib/notify/email")>()),
  sendTrialLinkEmail: (...a: unknown[]) => sendMail(...a),
}));
vi.mock("@/lib/notify/telegram", () => ({ notifyTrialCreated: (...a: unknown[]) => notify(...a) }));

import { GET, POST } from "@/app/api/trial/route";
import { trialLinkEmail } from "@/lib/notify/email";

type Res = { status: number; body: { ok: boolean; error?: string; resent?: boolean; enabled?: boolean; code?: string } };
let n = 0;
const valid = { clinicName: "Gülüş Diş", contactName: "Ayşe Yılmaz", phone: "0532 123 45 67", email: "Klinik@Ornek.com" };
const req = (body: object = valid, ip = `10.2.0.${++n}`) =>
  POST(new Request("http://localhost:3000/api/trial", { method: "POST", headers: { "x-forwarded-for": ip }, body: JSON.stringify(body) })) as unknown as Promise<Res>;

const trial = { id: "t1", code: "abcdefgh23", clinicName: "Gülüş Diş", expiresAt: "2026-12-05T06:00:00Z", maxCalls: 15 };

describe("POST /api/trial (self-serve)", () => {
  const env = { ...process.env };
  beforeEach(() => {
    Object.assign(process.env, { DEMO_CALL_ENABLED: "true", VAPI_API_KEY: "priv", VAPI_ORG_ID: "org", RESEND_API_KEY: "re_test" });
    trialByEmail.mockResolvedValue(null);
    selfServeCounts.mockResolvedValue({ today: 0, fromIp: 0 });
    addDemoRequest.mockResolvedValue("req-1");
    createTrial.mockResolvedValue({ ok: true, data: trial });
    sendMail.mockResolvedValue(true);
  });
  afterEach(() => {
    process.env = { ...env };
    vi.clearAllMocks();
  });

  it("is off without calls or email configured", async () => {
    process.env.RESEND_API_KEY = "";
    expect(((await GET()) as unknown as Res).body.enabled).toBe(false);
    expect((await req()).status).toBe(503);
    expect(createTrial).not.toHaveBeenCalled();
  });

  it("creates the trial and emails the link — never returns it", async () => {
    const r = await req();
    expect(r.status).toBe(200);
    expect(JSON.stringify(r.body)).not.toContain(trial.code);
    expect(createTrial).toHaveBeenCalledWith(
      expect.objectContaining({ clinicName: "Gülüş Diş", demoRequestId: "req-1", self: expect.objectContaining({ email: "klinik@ornek.com" }) }),
    );
    const [to, mail] = sendMail.mock.calls[0];
    expect(to).toBe("klinik@ornek.com");
    expect(mail.link).toBe("http://localhost:3000/dene/abcdefgh23");
    expect(notify).toHaveBeenCalled();
    expect(JSON.stringify(notify.mock.calls[0])).not.toContain("Ayşe");
  });

  it("validates the form", async () => {
    expect((await req({ ...valid, email: "nope" })).body.error).toBe("email");
    expect((await req({ ...valid, phone: "12" })).body.error).toBe("phone");
    expect((await req({ ...valid, clinicName: "x" })).body.error).toBe("clinic_name");
    expect((await req({ ...valid, email: "yiğit@ornek.com" })).body.error).toBe("email_ascii");
    expect(createTrial).not.toHaveBeenCalled();
  });

  it("drops bots silently", async () => {
    expect((await req({ ...valid, website: "spam" })).body.ok).toBe(true);
    expect(createTrial).not.toHaveBeenCalled();
  });

  it("re-sends the same link instead of opening a second trial for an address", async () => {
    trialByEmail.mockResolvedValue(trial);
    const r = await req();
    expect(r.body).toEqual({ ok: true, resent: true });
    expect(createTrial).not.toHaveBeenCalled();
    expect(sendMail.mock.calls[0][1].link).toContain("/dene/abcdefgh23");
  });

  it("allows one new trial per IP per day and five in total", async () => {
    selfServeCounts.mockResolvedValue({ today: 1, fromIp: 1 });
    expect((await req()).body.error).toBe("ip_limit");
    selfServeCounts.mockResolvedValue({ today: 5, fromIp: 0 });
    expect((await req()).body.error).toBe("daily_full");
    selfServeCounts.mockResolvedValue(null);
    expect((await req()).status).toBe(500);
    expect(createTrial).not.toHaveBeenCalled();
  });

  it("undoes the trial when the email can't be sent", async () => {
    sendMail.mockResolvedValue(false);
    const r = await req();
    expect(r.body.error).toBe("email_failed");
    expect(deleteTrial).toHaveBeenCalledWith("t1");
  });

  it("links to the fixed domain in production, not the Host header", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await POST(new Request("https://evil.example/api/trial", { method: "POST", headers: { "x-forwarded-for": "10.3.0.1" }, body: JSON.stringify(valid) }));
    vi.unstubAllEnvs();
    expect(sendMail.mock.calls[0][1].link).toBe("https://www.randevoxai.com/dene/abcdefgh23");
  });
});

describe("trial link email", () => {
  it("escapes what the visitor typed", () => {
    const m = trialLinkEmail({ clinicName: "<b>X</b>", contactName: "A", link: "https://www.randevoxai.com/dene/abc", expiresAt: trial.expiresAt, maxCalls: 15 });
    expect(m.html).not.toContain("<b>X</b>");
    expect(m.html).toContain("https://www.randevoxai.com/dene/abc");
    expect(m.text).toContain("15 görüşme");
  });
});

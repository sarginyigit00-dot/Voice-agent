import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/vapi/client", () => ({ webhookSecret: vi.fn(), toE164: vi.fn() }));
// The route imports a lot of server-side modules; none run before the secret check.
vi.mock("@/lib/actions/run", () => ({}));
vi.mock("@/lib/calls/log", () => ({}));
vi.mock("@/lib/booking/tools", () => ({}));
vi.mock("@/lib/calls/transcript", () => ({}));
vi.mock("@/lib/clinics/server", () => ({}));
vi.mock("@/lib/vapi/routing", () => ({}));
vi.mock("@/lib/booking/store", () => ({}));
vi.mock("@/lib/automation/emit", () => ({}));
vi.mock("@/lib/notify/telegram", () => ({}));
vi.mock("@/lib/automation/format", () => ({}));
vi.mock("@/lib/leads/callback", () => ({}));
vi.mock("@/lib/notify/email", () => ({}));
const trialIdForAssistant = vi.fn();
const recordTrialCall = vi.fn();
vi.mock("@/lib/demo/trials-server", () => ({
  trialIdForAssistant: (...a: unknown[]) => trialIdForAssistant(...a),
  recordTrialCall: (...a: unknown[]) => recordTrialCall(...a),
}));
vi.mock("next/server", () => ({
  after: () => {},
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }) },
}));

import { webhookSecret } from "@/lib/vapi/client";
import { POST } from "@/app/api/vapi/webhook/route";

const call = (secret?: string) =>
  POST(new Request("http://x", { method: "POST", headers: secret ? { "x-vapi-secret": secret } : {}, body: "{}" }));

afterEach(() => vi.resetAllMocks());

describe("vapi webhook secret", () => {
  it("fails closed when no secret is configured", async () => {
    vi.mocked(webhookSecret).mockReturnValue(null);
    expect((await call("anything")).status).toBe(503);
  });

  it("rejects a missing or wrong secret", async () => {
    vi.mocked(webhookSecret).mockReturnValue("s3cret");
    expect((await call()).status).toBe(401);
    expect((await call("nope")).status).toBe(401);
  });

  it("accepts the right secret", async () => {
    vi.mocked(webhookSecret).mockReturnValue("s3cret");
    expect((await call("s3cret")).status).toBe(200);
  });
});

describe("vapi webhook — landing-page demo assistant", () => {
  const post = (message: unknown) =>
    POST(
      new Request("http://x", { method: "POST", headers: { "x-vapi-secret": "s3cret" }, body: JSON.stringify({ message }) }),
    ) as unknown as Promise<{ status: number; body: { results?: { toolCallId: string; result: string }[]; ignored?: string } }>;

  afterEach(() => delete process.env.VAPI_DEMO_ASSISTANT_ID);

  it("answers its tools with sample data, touching no clinic code", async () => {
    vi.mocked(webhookSecret).mockReturnValue("s3cret");
    process.env.VAPI_DEMO_ASSISTANT_ID = "demo-asst";
    // resolveCallOwner, booking and notify modules are mocked as empty: calling any of them would throw.
    const res = await post({
      type: "tool-calls",
      call: { assistantId: "demo-asst" },
      toolCallList: [{ id: "t1", function: { name: "check_availability", arguments: "{}" } }],
    });
    expect(res.status).toBe(200);
    expect(res.body.results?.[0].toolCallId).toBe("t1");
    expect(JSON.parse(res.body.results![0].result).ok).toBe(true);
  });

  it("ignores its end-of-call report", async () => {
    vi.mocked(webhookSecret).mockReturnValue("s3cret");
    process.env.VAPI_DEMO_ASSISTANT_ID = "demo-asst";
    const res = await post({ type: "end-of-call-report", call: { assistantId: "demo-asst" } });
    expect(res.body.ignored).toBe("demo");
  });
});

describe("vapi webhook — clinic trial assistant", () => {
  const post = (message: unknown) =>
    POST(
      new Request("http://x", { method: "POST", headers: { "x-vapi-secret": "s3cret" }, body: JSON.stringify({ message }) }),
    ) as unknown as Promise<{ status: number; body: { results?: { result: string }[]; ignored?: string } }>;

  it("answers a trial's tools with sample data", async () => {
    vi.mocked(webhookSecret).mockReturnValue("s3cret");
    trialIdForAssistant.mockResolvedValue("trial-1");
    const res = await post({
      type: "tool-calls",
      call: { assistantId: "trial-asst" },
      toolCallList: [{ id: "t1", function: { name: "book_appointment", arguments: { start: "2026-12-01T07:00:00.000Z" } } }],
    });
    expect(JSON.parse(res.body.results![0].result).ok).toBe(true);
  });

  it("counts a trial's finished call", async () => {
    vi.mocked(webhookSecret).mockReturnValue("s3cret");
    trialIdForAssistant.mockResolvedValue("trial-1");
    const res = await post({ type: "end-of-call-report", call: { id: "call-9", assistantId: "trial-asst" }, durationSeconds: 42.5 });
    expect(res.body.ignored).toBe("demo");
    expect(recordTrialCall).toHaveBeenCalledWith("trial-1", "call-9", 42.5);
  });
});

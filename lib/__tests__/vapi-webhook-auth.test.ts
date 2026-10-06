import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/vapi/client", () => ({ webhookSecret: vi.fn(), toE164: vi.fn() }));
// The route imports a lot of server-side modules; none run before the secret check.
vi.mock("@/lib/actions/run", () => ({}));
vi.mock("@/lib/calls/log", () => ({}));
vi.mock("@/lib/booking/tools", () => ({}));
vi.mock("@/lib/calls/sentiment", () => ({}));
vi.mock("@/lib/calls/transcript", () => ({}));
vi.mock("@/lib/clinics/server", () => ({}));
vi.mock("@/lib/vapi/routing", () => ({}));
vi.mock("@/lib/booking/store", () => ({}));
vi.mock("@/lib/automation/emit", () => ({}));
vi.mock("@/lib/notify/telegram", () => ({}));
vi.mock("@/lib/automation/format", () => ({}));
vi.mock("@/lib/leads/callback", () => ({}));
vi.mock("@/lib/notify/email", () => ({}));
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

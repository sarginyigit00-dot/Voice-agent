import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ getSupabaseServer: () => null }));
vi.mock("next/server", () => ({ after: (fn: () => unknown) => fn() }));

import { onboardingEmail, type OnboardingKind } from "@/lib/onboarding/emails";
import { sendEmail } from "@/lib/notify/email";

const KINDS: OnboardingKind[] = ["welcome", "ready", "day3", "day7"];

describe("onboardingEmail", () => {
  it("greets the clinic by name in every kind", () => {
    for (const kind of KINDS) {
      const mail = onboardingEmail(kind, "Gülüş Diş");
      expect(mail.subject.length).toBeGreaterThan(0);
      expect(mail.html).toContain("Merhaba Gülüş Diş ekibi,");
      expect(mail.text).toContain("Merhaba Gülüş Diş ekibi,");
      expect(mail.text).toContain("Randevox Ekibi");
    }
  });

  it("links the right panel page", () => {
    expect(onboardingEmail("ready", "X").html).toContain("https://www.randevoxai.com/randevular");
    expect(onboardingEmail("day3", "X").html).toContain("https://www.randevoxai.com/calls");
    expect(onboardingEmail("day7", "X").html).toContain("https://www.randevoxai.com/klinik");
    expect(onboardingEmail("welcome", "X").html).not.toContain("<a ");
  });

  it("escapes the clinic name", () => {
    const mail = onboardingEmail("welcome", `<b>"A&B"</b>`);
    expect(mail.html).toContain("&lt;b&gt;&quot;A&amp;B&quot;&lt;/b&gt;");
    expect(mail.html).not.toContain("<b>");
  });
});

describe("sendEmail reply-to", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("passes reply_to to Resend only when given", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-key");
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await sendEmail("a@b.com", "s", "<p>h</p>", "h", "destek@randevoxai.com");
    await sendEmail("a@b.com", "s", "<p>h</p>", "h");

    const bodies = fetchMock.mock.calls.map((c) => JSON.parse((c as unknown as [string, RequestInit])[1].body as string));
    expect(bodies[0].reply_to).toBe("destek@randevoxai.com");
    expect(bodies[1]).not.toHaveProperty("reply_to");
  });
});

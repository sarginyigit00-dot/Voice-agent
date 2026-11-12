import { describe, expect, it } from "vitest";
import { composeSystemPrompt } from "@/lib/agents/prompt";
import { STARTER_AGENTS } from "@/lib/agents/starter";
import { withRecordingNotice } from "@/lib/vapi/client";

describe("KVKK notice", () => {
  it("keeps the opening line short — nothing beyond the AI + recording notice", () => {
    expect(withRecordingNotice("Merhaba, Örnek Diş Kliniği. Size nasıl yardımcı olabilirim?", "tr")).toBe(
      "Merhaba, Örnek Diş Kliniği. Ben yapay zekâ asistanıyım. Görüşmeniz randevunuzu oluşturmak için kaydedilir ve işlenir. Size nasıl yardımcı olabilirim?",
    );
  });

  it("puts the on-request privacy notice in the prompt, with the clinic's name", () => {
    const prompt = composeSystemPrompt(STARTER_AGENTS[0], "tr", { clinicName: "Örnek Diş Kliniği" });
    expect(prompt).toContain("# Aydınlatma");
    expect(prompt).toContain("veri sorumlusu olarak Örnek Diş Kliniği adına işlenir");
    expect(prompt).toContain("yurt dışına aktarılır");
    expect(prompt).toContain("Arayan sormadıkça bu metni asla okuma");
    expect(prompt).not.toContain("{klinik} adına");
  });
});

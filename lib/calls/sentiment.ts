export type Sentiment = "positive" | "neutral" | "negative";

/**
 * Classifies the caller's overall sentiment from the transcript alone —
 * Vapi's end-of-call report carries no sentiment score, so this is the real
 * version of what lib/actions/executors/qualify.ts calls "a project wiring a
 * real scoring prompt through its LLM integration", scoped to just sentiment.
 *
 * Raw `fetch` against Anthropic's API, matching how lib/calcom/client.ts
 * talks to Cal.com — no SDK dependency for one call site. Degrades to
 * "neutral" on a missing key, a network failure, or an unparseable reply:
 * this must never be the thing that breaks a webhook response.
 */
export async function computeSentiment(transcript: { speaker: string; text: string }[]): Promise<Sentiment> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return "neutral";

  const lines = transcript.map((t) => `${t.speaker}: ${t.text}`).join("\n").trim();
  if (!lines) return "neutral";

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 8,
        messages: [
          {
            role: "user",
            content:
              "Bu bir telefon görüşmesi dökümü. Arayanın genel duygu durumunu tek kelimeyle sınıflandır: positive, neutral veya negative. Sadece o kelimeyi yaz, başka hiçbir şey yazma.\n\n" +
              lines.slice(0, 6000),
          },
        ],
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return "neutral";

    const body = await res.json();
    const text = String(body?.content?.[0]?.text ?? "").trim().toLowerCase();
    if (text.includes("positive")) return "positive";
    if (text.includes("negative")) return "negative";
    return "neutral";
  } catch {
    return "neutral";
  }
}

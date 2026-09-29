// Scripted-call harness: runs the real system prompt + booking tool schemas
// against gpt-4o-mini with a fixed list of caller lines, fakes the tool
// results, and checks the conversation for the mistakes real calls made
// (re-asking, booking without a yes, long turns). Text only — barge-in and
// silence need a real phone call.
// npx tsx --env-file=.env.local scripts/simulate-calls.ts [scenario-id]
import { AGENTS } from "@/lib/demo/data";
import { composeSystemPrompt } from "@/lib/agents/prompt";
import { BOOKING_TOOLS } from "@/lib/vapi/client";

const MODEL = "gpt-4o-mini";
// Fallback for this harness only when the OpenAI key has no credit — the real
// agent (lib/vapi/client.ts) still runs gpt-4o-mini in production.
const PROVIDER: "openai" | "anthropic" = process.env.OPENAI_API_KEY && !process.env.FORCE_ANTHROPIC ? "openai" : "anthropic";
const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";

type Msg = { role: "system" | "user" | "assistant" | "tool"; content?: string | null; tool_calls?: any[]; tool_call_id?: string };
interface Turn { user: string; assistant: string; tools: string[] }

interface Scenario {
  id: string;
  title: string;
  lines: string[];
  /** Returns failure messages. */
  check: (turns: Turn[]) => string[];
}

const asks = (turns: Turn[], re: RegExp, from = 0) => turns.slice(from).filter((t) => re.test(t.assistant)).length;
const NAME_Q = /adınız|isminiz|adınızı|isminizi|adınız nedir/i;
const DAY_Q = /hangi gün|hangi tarih|ne zaman/i;
const SERVICE_Q = /hangi hizmet|ne için|hangi işlem|hangi konuda/i;

/** Book must not be called before the caller has said a yes to a summary. */
function bookAfterYes(turns: Turn[]): string[] {
  const fails: string[] = [];
  turns.forEach((t, i) => {
    if (!t.tools.includes("book_appointment")) return;
    const prevAssistant = i > 0 ? turns[i - 1].assistant : "";
    const said = /\b(evet|tamam|doğru|olur)\b/i.test(t.user);
    if (!said || !/\?/.test(prevAssistant)) fails.push(`tur ${i + 1}: onaysız book_appointment ("${t.user}")`);
  });
  return fails;
}

const SCENARIOS: Scenario[] = [
  {
    id: "all-in-one",
    title: "Tüm bilgi tek cümlede: hiçbiri tekrar sorulmamalı",
    lines: ["Yarın öğleden sonra dolgu için randevu almak istiyorum, adım Ayşe Yılmaz.", "Üç buçuk olur.", "Tamam, öğleden sonra üç olsun.", "Evet, doğru."],
    check: (t) => [
      ...(asks(t, NAME_Q) ? ["adı tekrar sordu"] : []),
      ...(asks(t, SERVICE_Q) ? ["hizmeti tekrar sordu"] : []),
      ...(asks(t, DAY_Q, 0) > 0 && asks(t, /yarın/i) === 0 ? ["günü tekrar sordu"] : []),
      ...bookAfterYes(t),
      ...(t.some((x) => x.tools.includes("book_appointment")) ? [] : ["hiç randevu oluşturmadı"]),
    ],
  },
  {
    id: "name-once",
    title: "Ad bir kez söylendi: bir daha sorulmamalı",
    lines: ["Merhaba, ben Mehmet Kaya. Randevu almak istiyorum.", "Muayene için.", "Cuma sabah olabilir mi?", "Evet."],
    check: (t) => [...(asks(t, NAME_Q) ? ["adı sordu (zaten söylenmişti)"] : []), ...bookAfterYes(t)],
  },
  {
    id: "date-once",
    title: "Tarih söylendi: tekrar sorulmamalı",
    lines: ["Salı günü kontrol için gelmek istiyorum.", "Adım Zeynep Demir.", "Sabah dokuz olur.", "Evet."],
    check: (t) => [...(asks(t, DAY_Q, 1) ? ["günü tekrar sordu"] : []), ...bookAfterYes(t)],
  },
  {
    id: "correction",
    title: "Arayan özet sırasında düzeltir: yeniden özet, sonra kayıt",
    lines: ["Cuma öğleden sonra muayene için randevu istiyorum, adım Can Öz.", "Üç olsun.", "Hayır, perşembe olsun.", "Evet."],
    check: (t) => {
      const fails = bookAfterYes(t);
      const idx = t.findIndex((x) => /perşembe/i.test(x.user));
      if (idx >= 0 && !/perşembe/i.test(t[idx].assistant) && !t[idx].tools.includes("check_availability")) fails.push("düzeltmeyi işlemedi");
      return fails;
    },
  },
  {
    id: "no-yes-no-book",
    title: "Arayan onay vermezse kayıt yapılmamalı",
    lines: ["Yarın sabah dolgu için randevu, adım Elif Şahin.", "Dokuz olsun.", "Bir dakika, eşimle konuşayım."],
    check: (t) => (t.some((x) => x.tools.includes("book_appointment")) ? ["onay olmadan kaydetti"] : []),
  },
  {
    id: "turkish-numbers",
    title: "Türkçe sayılı saat: doğru anlamalı",
    lines: ["Yarın için diş taşı temizliği, adım Burak Aydın.", "Saat on beş otuz uygun mu?", "Evet."],
    check: (t) => bookAfterYes(t),
  },
  {
    id: "unknown-price",
    title: "Bilinmeyen fiyat: uydurmamalı",
    lines: ["İmplant kaç para acaba?"],
    check: (t) => (/\d{3,}\s*(tl|lira)/i.test(t[0].assistant) ? ["fiyat uydurdu"] : []),
  },
  {
    id: "unclear",
    title: "Anlaşılmaz konuşma: tahmin etmemeli, kısa kalmalı",
    lines: ["ııı şey... [ses kesik] ...ran...", "[anlaşılmaz]", "Randevu."],
    check: (t) => [
      ...(t.some((x) => x.tools.includes("book_appointment")) ? ["anlamadan kaydetti"] : []),
      ...(asks(t, /tekrar|duyamadım|anlayamadım/i) === 0 ? ["tekrar istemedi"] : []),
    ],
  },
];

/** Global style checks applied to every scenario. */
function style(turns: Turn[]): string[] {
  const fails: string[] = [];
  turns.forEach((t, i) => {
    const sentences = t.assistant.split(/[.!?]+/).filter((s) => s.trim()).length;
    const qs = (t.assistant.match(/\?/g) ?? []).length;
    if (sentences > 3) fails.push(`tur ${i + 1}: ${sentences} cümle`);
    if (qs > 1) fails.push(`tur ${i + 1}: ${qs} soru`);
    if (/\d{1,2}:\d{2}|T\d{2}:\d{2}/.test(t.assistant)) fails.push(`tur ${i + 1}: rakamla saat okudu`);
  });
  return fails;
}

async function chatOpenAI(messages: Msg[]): Promise<Msg> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: MODEL, temperature: 0.3, messages, tools: BOOKING_TOOLS.map(({ type, function: f }) => ({ type, function: f })) }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  return (await res.json()).choices[0].message;
}

// Anthropic's Messages API shapes system prompt, roles and tool use
// differently from OpenAI's — this only translates the same Msg[] history
// back and forth so the rest of the harness stays provider-agnostic.
async function chatAnthropic(messages: Msg[]): Promise<Msg> {
  const system = messages.find((m) => m.role === "system")?.content ?? "";
  const rest = messages.filter((m) => m.role !== "system");
  type Block = { type: string; [k: string]: any };
  const body: { role: string; content: Block[] }[] = [];
  for (const m of rest) {
    if (m.role === "tool") {
      body.push({ role: "user", content: [{ type: "tool_result", tool_use_id: m.tool_call_id, content: m.content ?? "" }] });
    } else if (m.role === "assistant") {
      const blocks: Block[] = [];
      if (m.content) blocks.push({ type: "text", text: m.content });
      for (const c of m.tool_calls ?? []) blocks.push({ type: "tool_use", id: c.id, name: c.function.name, input: JSON.parse(c.function.arguments || "{}") });
      body.push({ role: "assistant", content: blocks });
    } else {
      body.push({ role: "user", content: [{ type: "text", text: m.content ?? "" }] });
    }
  }
  const tools = BOOKING_TOOLS.map(({ function: f }) => ({ name: f.name, description: f.description, input_schema: f.parameters }));
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens: 1024, temperature: 0.3, system, messages: body, tools }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.content.filter((b: Block) => b.type === "text").map((b: Block) => b.text).join(" ");
  const toolCalls = data.content
    .filter((b: Block) => b.type === "tool_use")
    .map((b: Block) => ({ id: b.id, function: { name: b.name, arguments: JSON.stringify(b.input) } }));
  return { role: "assistant", content: text || null, tool_calls: toolCalls.length ? toolCalls : undefined };
}

async function chat(messages: Msg[]): Promise<Msg> {
  return PROVIDER === "openai" ? chatOpenAI(messages) : chatAnthropic(messages);
}

function fakeTool(name: string, args: any): string {
  const iso = (h: number) => `2026-09-27T${String(h).padStart(2, "0")}:00:00+03:00`;
  if (name === "check_availability") {
    return JSON.stringify({
      ok: true,
      askPhone: false,
      slots: [iso(9), iso(11), iso(15)],
      spoken: ["yarın sabah dokuz", "yarın sabah on bir", "yarın öğleden sonra üç"],
    });
  }
  if (name === "book_appointment") return JSON.stringify({ ok: true, spoken: "Randevunuz oluşturuldu." });
  return JSON.stringify({ ok: false, spoken: "Randevu bulunamadı." });
}

async function run(s: Scenario): Promise<string[]> {
  const agent = AGENTS.find((a) => a.actionIds.includes("book"))!;
  let system = composeSystemPrompt(agent, "tr", {});
  // Vapi fills the Liquid date at call time; do the same here.
  system = system.replace(/\{\{"now"[^}]*\}\}/, "2026-09-26, Saturday");
  const messages: Msg[] = [{ role: "system", content: system }, { role: "assistant", content: agent.greeting.tr }];
  const turns: Turn[] = [];
  for (const line of s.lines) {
    messages.push({ role: "user", content: line });
    const turn: Turn = { user: line, assistant: "", tools: [] };
    for (let hop = 0; hop < 5; hop++) {
      const m = await chat(messages);
      messages.push({ role: "assistant", content: m.content ?? null, tool_calls: m.tool_calls });
      if (m.content) turn.assistant += (turn.assistant ? " " : "") + m.content;
      if (!m.tool_calls?.length) break;
      for (const c of m.tool_calls) {
        turn.tools.push(c.function.name);
        messages.push({ role: "tool", tool_call_id: c.id, content: fakeTool(c.function.name, JSON.parse(c.function.arguments || "{}")) });
      }
    }
    turns.push(turn);
  }
  console.log(`\n── ${s.id}: ${s.title}`);
  turns.forEach((t) => console.log(`  👤 ${t.user}\n  🤖 ${t.assistant}${t.tools.length ? `  [${t.tools.join(", ")}]` : ""}`));
  return [...s.check(turns), ...style(turns)];
}

(async () => {
  if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    console.log("OPENAI_API_KEY / ANTHROPIC_API_KEY yok — sadece prompt yazdırılıyor.\n");
    console.log(composeSystemPrompt(AGENTS.find((a) => a.actionIds.includes("book"))!, "tr", {}));
    return;
  }
  const only = process.argv[2];
  let failed = 0;
  for (const s of SCENARIOS.filter((x) => !only || x.id === only)) {
    const fails = await run(s);
    if (fails.length) {
      failed++;
      fails.forEach((f) => console.log(`  ✗ ${f}`));
    } else console.log("  ✓ geçti");
  }
  console.log(`\n${failed ? `${failed} senaryo başarısız` : "Tüm senaryolar geçti"}`);
  process.exit(failed ? 1 : 0);
})();

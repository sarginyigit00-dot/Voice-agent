# Vox — AI voice phone agents

A production-grade **Next.js 16** starter shaped into **Vox**: AI voice phone
agents that answer calls, book appointments, qualify leads and route — 24/7.
Dark, techy and minimal, inspired by **bland.ai** and **synthflow.ai**. Rebrand
it in five minutes.

## Quick start

```bash
npm install
npm run dev          # → http://localhost:3000  (runs in demo mode, no keys needed)
```

With no `.env.local`, Vox boots straight into **demo mode** — realistic call
logs, transcripts, live calls and voice agents from `lib/demo/data.ts`. Click
around immediately; nothing is real, nothing breaks.

## Make it yours

Open this folder in **Claude Code** and say:

> **"set up this project"**  (or run **`/setup`**, or open **`START-HERE.md`**)

Claude interviews you for your **brand**, **logo**, **colors** and the **API keys
this app needs** (a telephony/voice provider, an LLM, a calendar, Supabase), then
writes your `app.config.ts` and `.env.local` and boots it. Prefer to do it by
hand? Follow [`SETUP.md`](./SETUP.md) — every step names the exact file to change.

## What's inside

```
app.config.ts            ← single source of truth (brand, copy, nav, integrations)
app/(marketing)/         ← dark AI landing page (hero, interactive demo, pricing, FAQ)
app/(app)/dashboard/     ← the voice-agent COCKPIT (calls log, live calls, agents, charts)
app/(app)/calls/         ← full call log + transcript drawer
app/(app)/agents/        ← voice-agent builder
components/app/           ← waveform, charts, top-nav, status-bar
components/ui/            ← logo (waveform mark), buttons, cards, badges, inputs
lib/demo/data.ts          ← sample data that powers demo mode
.env.example              ← the keys this kit can use (all optional)
SETUP.md                  ← the guided-setup script
```

## Design

Dark-first (`html className="dark"`). **Sora** for UI, **JetBrains Mono** for
numbers and transcripts. Electric **violet** accent with a **cyan** secondary,
on near-black surfaces with hairline borders. A voice-waveform logomark and an
animated equalizer motif throughout. All visuals are inline SVG / CSS — no photos.

## Integrations (wired by setup)

- **Vapi / Twilio** — telephony + realtime voice, phone numbers, transfers
- **OpenAI / Anthropic** — the LLM brain behind each agent
- **Cal.com / Google Calendar** — live availability + booking
- **Supabase** — accounts, agents, call history & transcripts

All optional. Missing keys keep that feature in demo mode.

## Stack

Next.js 16 (App Router) · React 19 · Tailwind v4 · lucide-react.
No database required to run — it falls back to realistic demo data.

# Working in this project (read me first)

This is **Vox** — a GoatStarter kit shaped into a real product: **AI voice phone
agents** that answer calls, book appointments, qualify leads and route — 24/7.
Production-grade Next.js 16, built to be rebranded fast.

**Design language:** a dark, dark-first AI-voice cockpit inspired by **bland.ai**
(mono, minimal, electric accent) and **synthflow.ai** (violet/purple gradient,
clean flow). Near-black surfaces, hairline borders, **JetBrains Mono** tabular
numbers + transcripts, an **electric violet** primary with a **cyan** secondary,
and a **waveform / phone-pulse** motif throughout. Dark is the default theme
(`html className="dark"`, `defaultTheme="dark"`). The app shell uses a **top tab
nav + footer status bar** (no left sidebar). UI text is in **Sora**
(`--font-sans`); numbers/transcripts in `--font-mono`.

## The single source of truth

`app.config.ts` drives the brand, the marketing page, the dashboard navigation,
and the list of integrations this kit expects (Vapi/Twilio voice, an LLM, a
calendar, Supabase). Read it before changing UI copy.

## Bilingual (TR + EN)

Every user-facing string is `{ tr: "…", en: "…" }`. When you edit copy, **keep
both languages**. Shared UI strings (auth, nav chrome, buttons) live in
`lib/i18n/dict.ts`. The default language is set in `lib/i18n/config.ts`
(`DEFAULT_LANG`). A live TR/EN toggle sits in the navbar, cockpit top-nav and
auth pages.

## Auth

`/login` and `/signup` (`components/auth/auth-screen.tsx`) do **real Supabase
auth** (`signInWithPassword` / `signUp`) once `NEXT_PUBLIC_SUPABASE_URL` +
`NEXT_PUBLIC_SUPABASE_ANON_KEY` are set — session lives in the browser
(`lib/supabase/client.ts`), `components/auth/session.tsx` exposes it via
`useSession()`/`AuthGate`, and `app/(app)/layout.tsx` gates the whole cockpit
behind it. "Continue with demo" still bypasses auth entirely (sets
`localStorage["randevox:demo"]`) regardless of whether Supabase is configured
— this kit is meant to be clickable without an account. Without the two env
vars, every form submit silently falls back to the demo bypass too.

## Data model & demo mode

With no Supabase keys in `.env.local`, the cockpit renders from
`lib/demo/data.ts` (`CALLS`, `LIVE_CALLS`, `AGENTS`, `outcomes`, `callVolume`,
`minutes`, plus marketing-only data `TICKER`, `TESTIMONIALS`, `USE_CASES`,
`COMPARE`, `DEMO_SCRIPT` — those last ones are landing-page copy and stay
static either way). Once Supabase is configured, `/agents`, `/calls` and the
dashboard read/write the real `agents` and `calls` tables instead
(`lib/agents/queries.ts`, `lib/calls/queries.ts`, both browser-side —
`supabase-js` attaches the signed-in user's token to every request, and RLS
does the rest, see `supabase/schema.sql`). A brand-new (empty) `agents` table
is auto-seeded with the four starter agents on first load of `/agents`. KPIs,
the outcomes donut and the call-volume chart on the dashboard are computed
live from the real `calls` rows once any exist; "live calls" (in-progress)
has no real source yet — it just goes empty, since that needs a real-time
Vapi status feed, not a REST table. `/calls` and the dashboard both resolve
`agentId` through whichever agents list is active (real or demo).

## Post-call actions (the EYLEMLER toggles)

Each agent's 5 action toggles (book / transfer / SMS / CRM / qualify, defined once in
`lib/actions/registry.ts`) run through a single pipeline: `app/api/vapi/webhook/route.ts`
receives Vapi's `end-of-call-report` for a real call, then `lib/actions/run.ts` calls the
matching executor in `lib/actions/executors/*.ts` for each action id the agent has enabled.
Independent of which actions are enabled, that same webhook also logs every finished call
into the `calls` table (`lib/calls/log.ts`) — that's what backs `/calls` and the dashboard
once Supabase is connected. CRM is the one action with a real implementation — it's our **own internal CRM**:
`lib/actions/executors/crm.ts` inserts the call (caller, summary, full transcript) into the
`crm_records` table in Supabase (schema in `supabase/schema.sql`, client in
`lib/supabase/server.ts`), viewable at `/crm` (`app/(app)/crm/page.tsx`, backed by
`app/api/crm/route.ts` → `lib/crm/queries.ts`). If `CRM_WEBHOOK_URL` is also set, the same
call is additionally forwarded there for an external CRM (Zapier/Make/n8n etc.) — that part
stays optional. As a safety net for calls the webhook path missed, `app/api/cron/crm-sync`
(`lib/crm/sync.ts`, scheduled every 5 minutes in `vercel.json`, protected by `CRON_SECRET`)
re-scans the `calls` table and upserts anything not yet in `crm_records` — `crm_records.call_id`
is uniquely indexed, so both paths are idempotent. The other four actions report a `"demo"` result until a project wires their
real call in. `app/api/actions/test` lets Settings → Integrations → CRM fire a fake call at
the pipeline so a user can confirm it without a live phone call.

## Cockpit components (reuse these)

- `components/app/waveform.tsx` — inline-SVG voice equalizer (static or animated
  with a play/pause), the signature motif.
- `components/app/charts.tsx` — `AreaChart` (call volume) + `Donut` (outcomes),
  pure inline SVG.
- `components/app/top-nav.tsx` + `status-bar.tsx` — the app shell chrome.
- `components/ui/logo.tsx` — the bespoke voice-waveform `LogoMark`.

The **dashboard** (`app/(app)/dashboard`) is the voice cockpit: KPI row, recent
calls log → click a row to open the **transcript drawer** (turn-by-turn,
recording scrubber, extracted action items), a **live calls** panel with a
play/pause, a **voice agents** list with toggles, an **agent-builder preview**,
the **call-volume** area chart, the **outcomes** donut and a **minutes** meter.
`app/(app)/calls` and `app/(app)/agents` are the feature pages.

**No fake photos** anywhere — all visuals are inline SVG / CSS. lucide v1 has no
brand icons; use generic or inline SVG for tools/socials.

## This is NOT the Next.js you may know

This is Next.js 16 (App Router, React 19, Tailwind v4). APIs and conventions may
differ from older training data. If unsure about a Next.js API, check
`node_modules/next/dist/docs/` before writing code, and heed deprecation notices.

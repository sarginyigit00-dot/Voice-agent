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

## Multi-tenant: clinics (read before touching data code)

Randevox is sold **turnkey** to clinics: the operator creates each clinic and
its staff accounts from `/admin` (Klinikler tab, `lib/admin/clinics.ts`);
there is no self-serve sign-up (`/signup` redirects to the demo-request form `/demo-talep`, whose
submissions land in /admin → Demo talepleri). Every
operational table — `agents`, `calls`, `crm_records`, `appointments` —
carries a NOT NULL `clinic_id`, and RLS lets a signed-in user see only the
clinics they're in (`clinic_members`, via `my_clinic_ids()`). A signed-in
account with no clinic gets a "not linked to a clinic" screen from
`AuthGate`.

**Server code runs with the service-role key, which bypasses RLS** — so it
must scope itself: panel routes call `requireMember(req)` (not bare
`requireUser`) and filter by `clinic.id`; the Vapi webhook finds the clinic
through `resolveCallOwner(assistantId)` (`lib/clinics/server.ts`) and writes
**nothing** for an assistant it can't place — never fall back to "the first
agent". Per-clinic credentials (Cal.com key + event type) live in
`clinic_secrets` (no RLS policies = unreadable to users) and are read with
`calcomConfigFor(clinic)`; there is deliberately no env fallback for a real
clinic. Per-clinic settings (transfer number, notify email, CRM webhook
URL, quota, status) are columns on `clinics`. A `suspended` clinic's calls
are still logged but its tools and actions don't run.

## Vapi provisioning

Agents are never configured by hand in the Vapi dashboard. Saving an agent on
`/agents` writes the row (browser, RLS), then calls `app/api/agents/sync`,
which re-reads the row scoped to the caller's clinic and pushes the whole
assistant through `lib/vapi/client.ts` (`buildAssistant`: `composeSystemPrompt`,
greeting, Azure tr-TR voice, `check_availability` / `book_appointment`,
`transferCall` to `clinics.transfer_number` — these three live in Vapi's Tools
library (booking pair shared by all clinics, one transfer tool per clinic) and
are upserted by name on every sync, server URL + `x-vapi-secret`,
summary + structured-data plan). The returned id lands in
`agents.vapi_assistant_id` — the ONLY key the webhook matches a call on, and
never written from the browser. Deleting an agent goes through the same route
so its assistant goes too. Phone numbers stay manual (Netgsm SIP → Vapi BYO
number, `TELEFON-KURULUMU.md`); the operator stores the Vapi phone-number id
on the clinic and picks the answering agent in /admin → Klinikler → Telefon
(which can also provision all of a clinic's agents at once).
`VAPI_WEBHOOK_SECRET` must be identical locally and on Vercel.

**Clinic facts (/klinik).** Services (price, duration, specialty), doctors,
address and FAQ live in `clinic_knowledge`, one row per clinic
(`lib/clinics/knowledge-shape.ts` holds the shape, validator, demo data and
the "# Klinik bilgileri" prompt block). Every agent of the clinic gets that
block in its system prompt on each sync; saving on /klinik goes through
`app/api/clinic/knowledge`, which re-pushes the clinic's live agents
(`syncClinicAgents`). Anything the agent reads aloud in Turkish — times,
dates, opening hours — is produced as words by `lib/speech/tr.ts`, never as
"09:00"; panel text keeps digits.

## Data model & demo mode

With no Supabase keys in `.env.local`, the cockpit renders from
`lib/demo/data.ts` (`CALLS`, `LIVE_CALLS`, `AGENTS`, `outcomes`, `callVolume`,
`minutes`, plus marketing-only data `TICKER`, `TESTIMONIALS`, `USE_CASES`,
`COMPARE`, `DEMO_SCRIPT` — those last ones are landing-page copy and stay
static either way). Once Supabase is configured, `/agents`, `/calls` and the
dashboard read/write the real `agents` and `calls` tables instead
(`lib/agents/queries.ts`, `lib/calls/queries.ts`, both browser-side —
`supabase-js` attaches the signed-in user's token to every request, and RLS
does the rest, see `supabase/schema.sql`). A brand-new clinic's (empty) agent
list is auto-seeded with the four starter agents on first load of `/agents`,
under fresh ids (`agents.id` is unique across all clinics). KPIs,
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
`app/api/crm/route.ts` → `lib/crm/queries.ts`). If the clinic has a `crm_webhook_url`, the same
call is additionally forwarded there for an external CRM (Zapier/Make/n8n etc.) — that part
stays optional (the env `CRM_WEBHOOK_URL` is only used without Supabase). As a safety net for calls the webhook path missed, `app/api/cron/crm-sync`
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

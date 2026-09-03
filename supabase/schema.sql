-- ═══════════════════════════════════════════════════════════════════════════
--  Randevox — Supabase schema
--
--  Run this ONCE in the Supabase SQL editor:
--    Dashboard → your project → SQL Editor → New query → paste this whole
--    file → Run. It's idempotent (every statement is "if not exists" /
--    "or replace"), so re-running it after a partial run or a future update
--    is always safe and never duplicates data.
--
--  Security model: every table below is readable/writable only by an
--  AUTHENTICATED user (`to authenticated`) — nobody signed out, and no
--  anonymous API key, can read or write any row. This kit is built for a
--  single clinic/team: everyone who has an account (every row in
--  `auth.users`) is that team's staff and shares the same operational data
--  — the same call log, the same voice agents. That's "only a signed-in
--  user can see their own data" applied to a shared team workspace, the
--  same way the rest of this dashboard already assumes one team per
--  deployment. If you later turn this into a multi-tenant product where
--  each sign-up gets their own private clinic, add an `owner_id uuid
--  references auth.users` column to `agents`/`calls` and change `using
--  (true)` below to `using (owner_id = auth.uid())`.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────
--  agents — the voice agents managed on /agents (name, voice, greeting,
--  which post-call actions it runs). Replaces the AGENTS demo array once
--  Supabase is connected; the dashboard and /calls pages read from here too
--  (to resolve a call's agentId to a name).
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.agents (
  id text primary key,
  name text not null,
  voice text not null default 'Nova · warm female',
  -- bilingual copy, same { tr, en } shape as everywhere else in the app
  purpose jsonb not null default '{"tr": "", "en": ""}'::jsonb,
  greeting jsonb not null default '{"tr": "", "en": ""}'::jsonb,
  active boolean not null default true,
  calls_today integer not null default 0,
  -- ids from lib/actions/registry.ts: book | transfer | sms | crm | qualify
  action_ids text[] not null default '{}',
  -- The clinic's own instructions (services, prices, FAQ, escalation rules).
  -- Single-language free prose; lib/agents/prompt.ts wraps it into the full
  -- instruction block shown on /agents.
  system_prompt text not null default '',
  -- When this line books. Shape in lib/agents/hours.ts; enforced in
  -- lib/booking/tools.ts, which refuses slots outside it.
  working_hours jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- For projects whose agents table predates these two columns.
alter table public.agents
  add column if not exists system_prompt text not null default '';
alter table public.agents
  add column if not exists working_hours jsonb not null default '{}'::jsonb;

alter table public.agents enable row level security;

drop policy if exists "Authenticated users can manage agents" on public.agents;
create policy "Authenticated users can manage agents"
  on public.agents for all
  to authenticated
  using (true)
  with check (true);

-- ─────────────────────────────────────────────────────────────────────────
--  calls — the call log behind /calls and the dashboard's "recent calls"
--  table. Written by the Vapi webhook (app/api/vapi/webhook/route.ts) via
--  the service role key once a call ends, independent of whether that
--  agent also has the "CRM'e kaydet" action on (that's the separate
--  crm_records table below).
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.calls (
  id text primary key,
  agent_id text references public.agents (id) on delete set null,
  caller_name text not null default 'Unknown',
  caller_number text not null default '',
  started_at timestamptz not null default now(),
  duration_sec integer not null default 0,
  outcome text not null default 'resolved',
  summary text not null default '',
  transcript jsonb not null default '[]'::jsonb,
  -- human-readable notes from whichever post-call actions ran (see
  -- lib/actions/run.ts) — e.g. "CRM'e kaydedildi.". Not bilingual: these are
  -- generated server-side in one language at call time.
  actions text[] not null default '{}',
  -- Computed post-call from the transcript (lib/calls/sentiment.ts) — never
  -- from Vapi, which doesn't provide one. Defaults 'neutral' when no LLM key
  -- is configured, same degrade-gracefully rule as every other integration.
  sentiment text not null default 'neutral',
  -- Vapi's recording URL, when the assistant has recording enabled. Null for
  -- every call before this column existed, and for any call Vapi didn't
  -- record.
  recording_url text,
  created_at timestamptz not null default now()
);

-- For projects whose calls table predates these two columns.
alter table public.calls
  add column if not exists sentiment text not null default 'neutral';
alter table public.calls
  add column if not exists recording_url text;

create index if not exists calls_created_at_idx on public.calls (created_at desc);
create index if not exists calls_agent_id_idx on public.calls (agent_id);

alter table public.calls enable row level security;

drop policy if exists "Authenticated users can read calls" on public.calls;
create policy "Authenticated users can read calls"
  on public.calls for select
  to authenticated
  using (true);

-- ─────────────────────────────────────────────────────────────────────────
--  crm_records — the internal "CRM" a call lands in when an agent has the
--  "CRM'e kaydet" / "Log to CRM" action enabled.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.crm_records (
  id uuid primary key default gen_random_uuid(),

  -- which call / agent this came from
  call_id text not null,
  agent_id text not null,
  agent_name text not null,

  -- who called
  caller_name text not null,
  caller_number text not null,

  -- when / how long / how it ended
  started_at timestamptz not null,
  duration_sec integer not null default 0,
  outcome text not null,

  -- what the call was about
  summary text not null,
  transcript jsonb not null default '[]'::jsonb,

  -- notes from the post-call actions that ran, same shape as calls.actions.
  -- The webhook can't fill this at write time (actions run in parallel, and
  -- the call is logged after them) — the cron sync backfills it.
  actions text[] not null default '{}',

  created_at timestamptz not null default now()
);

-- For projects that created crm_records before the column existed.
alter table public.crm_records
  add column if not exists actions text[] not null default '{}';

create index if not exists crm_records_created_at_idx on public.crm_records (created_at desc);
create index if not exists crm_records_caller_number_idx on public.crm_records (caller_number);

-- one crm_records row per call — lets the backfill sync (app/api/cron/crm-sync)
-- upsert on call_id without ever creating duplicates.
create unique index if not exists crm_records_call_id_idx on public.crm_records (call_id);

alter table public.crm_records enable row level security;

-- Inserts happen server-side only, from the Vapi webhook route, using the
-- service role key (which bypasses RLS). This policy just allows signed-in
-- dashboard users to read the log.
drop policy if exists "Authenticated users can read crm_records" on public.crm_records;
create policy "Authenticated users can read crm_records"
  on public.crm_records for select
  to authenticated
  using (true);

-- ─────────────────────────────────────────────────────────────────────────
--  waitlist_emails — the "Haberim olsun" box on the /on-kayit teaser page.
--  Inserts happen server-side only (service role key bypasses RLS); no
--  public policies on purpose — nobody, not even a signed-in user, can
--  list these through the API. It's a lead-capture inbox, not app data.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.waitlist_emails (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);

alter table public.waitlist_emails enable row level security;

-- ─────────────────────────────────────────────────────────────────────────
--  appointments — every slot the agent actually booked on Cal.com, one row
--  per call. Written server-side by lib/booking/store.ts, from both booking
--  paths: the mid-call tool (lib/booking/tools.ts, source 'in-call') and the
--  post-call safety net (lib/actions/executors/book.ts, source 'post-call').
--
--  The unique index on call_id is what makes booking idempotent — it is the
--  guard both paths check before calling Cal.com, so a Vapi webhook retry
--  can never book the same patient twice.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),

  -- the call this came from; also the idempotency key
  call_id text not null,

  -- Cal.com's booking uid, for cancelling or rescheduling later
  booking_uid text not null,

  starts_at timestamptz not null,

  attendee_name text not null default '',
  attendee_email text,
  attendee_phone text,

  -- 'in-call'  → booked live, while the caller was on the line (the norm)
  -- 'post-call' → booked from the end-of-call report, tool never fired
  source text not null default 'in-call',

  -- 'booked' | 'cancelled'. Cancelling goes through app/api/appointments/cancel,
  -- which cancels on Cal.com first and only then flips this — so a row marked
  -- cancelled here is always cancelled on the real calendar too.
  status text not null default 'booked',
  cancelled_at timestamptz,

  -- which agent took the call, so /randevular can show it
  agent_id text,

  created_at timestamptz not null default now()
);

-- For projects whose appointments table predates these columns.
alter table public.appointments
  add column if not exists status text not null default 'booked';
alter table public.appointments
  add column if not exists cancelled_at timestamptz;
alter table public.appointments
  add column if not exists agent_id text;

create unique index if not exists appointments_call_id_idx on public.appointments (call_id);
create index if not exists appointments_starts_at_idx on public.appointments (starts_at);

alter table public.appointments enable row level security;

-- Writes happen server-side only, with the service role key (which bypasses
-- RLS). This policy just lets signed-in dashboard users read the schedule.
drop policy if exists "Authenticated users can read appointments" on public.appointments;
create policy "Authenticated users can read appointments"
  on public.appointments for select
  to authenticated
  using (true);

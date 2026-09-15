-- ═══════════════════════════════════════════════════════════════════════════
--  Randevox — Supabase schema
--
--  Run this ONCE in the Supabase SQL editor:
--    Dashboard → your project → SQL Editor → New query → paste this whole
--    file → Run. It's idempotent (every statement is "if not exists" /
--    "or replace"), so re-running it after a partial run or a future update
--    is always safe and never duplicates data.
--
--  Security model: multi-tenant. Every customer is a row in `clinics`, and
--  every operational table (agents, calls, crm_records, appointments)
--  carries a `clinic_id`. A signed-in user sees only the rows of the
--  clinics they're a member of (`clinic_members`) — RLS enforces it through
--  `my_clinic_ids()`. Nobody signed out, and no anonymous key, reads
--  anything.
--
--  Server routes use the service-role key, which BYPASSES RLS — so they
--  scope themselves through lib/clinics/server.ts instead. Randevox is sold
--  turnkey: the operator creates clinics and their staff accounts from
--  /admin; nobody signs themselves into a clinic.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────
--  clinics — one row per customer. Created by the operator from /admin.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- 'klinik' | 'klinik_pro' — the packages in app.config.ts
  plan text not null default 'klinik',
  -- included minutes per calendar month; usage past it is billed as overage
  minutes_quota integer not null default 1000,
  -- 'active' | 'suspended'. Suspended: the agent hands every caller to a
  -- person and no post-call action runs (app/api/vapi/webhook/route.ts).
  status text not null default 'active',
  time_zone text not null default 'Europe/Istanbul',
  -- where the agent transfers a caller who asks for a person
  transfer_number text,
  vapi_phone_number_id text,
  -- booking confirmations when the caller gave no email; the weekly report
  notify_email text,
  -- legacy, superseded by message_channel; kept in step until dropped
  whatsapp_enabled boolean not null default false,
  -- patient messages via n8n: 'off' | 'sms' (Netgsm) | 'whatsapp'
  message_channel text not null default 'off' check (message_channel in ('off', 'sms', 'whatsapp')),
  -- optional: forward every finished call to this clinic's own CRM
  crm_webhook_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.clinic_members (
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- 'owner' | 'staff'
  role text not null default 'staff',
  created_at timestamptz not null default now(),
  primary key (clinic_id, user_id)
);

create index if not exists clinic_members_user_id_idx on public.clinic_members (user_id);

-- Third-party credentials, per clinic. RLS on with NO policies: no signed-in
-- user can read these — only server code holding the service-role key.
create table if not exists public.clinic_secrets (
  clinic_id uuid primary key references public.clinics (id) on delete cascade,
  calcom_api_key text,
  calcom_event_type_id integer,
  updated_at timestamptz not null default now()
);

-- The clinics the signed-in user belongs to. Security definer, so policies
-- can call it without recursing into clinic_members' own RLS.
create or replace function public.my_clinic_ids()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select clinic_id from public.clinic_members where user_id = auth.uid()
$$;

-- Column default for browser-side inserts (/agents): the client never has to
-- know its clinic id, and RLS's with-check still verifies whatever lands.
create or replace function public.my_default_clinic_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select clinic_id from public.clinic_members
  where user_id = auth.uid()
  order by created_at
  limit 1
$$;

-- Policies are "to authenticated", so the anonymous role never needs these.
revoke execute on function public.my_clinic_ids() from public, anon;
revoke execute on function public.my_default_clinic_id() from public, anon;
grant execute on function public.my_clinic_ids() to authenticated;
grant execute on function public.my_default_clinic_id() to authenticated;

alter table public.clinics enable row level security;
alter table public.clinic_members enable row level security;
alter table public.clinic_secrets enable row level security;

drop policy if exists "Members read their clinic" on public.clinics;
create policy "Members read their clinic"
  on public.clinics for select
  to authenticated
  using (id in (select public.my_clinic_ids()));

drop policy if exists "Users read their own memberships" on public.clinic_members;
create policy "Users read their own memberships"
  on public.clinic_members for select
  to authenticated
  using (user_id = auth.uid());

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

-- Which clinic owns this agent. The default fills it in from the signed-in
-- user's membership, so /agents inserts from the browser never name a clinic.
alter table public.agents
  add column if not exists clinic_id uuid default public.my_default_clinic_id()
    references public.clinics (id) on delete cascade;
-- The assistant this agent is on Vapi — how an incoming call finds its
-- agent, and through it its clinic (lib/clinics/server.ts).
alter table public.agents
  add column if not exists vapi_assistant_id text;

create index if not exists agents_clinic_id_idx on public.agents (clinic_id);
create unique index if not exists agents_vapi_assistant_id_idx
  on public.agents (vapi_assistant_id) where vapi_assistant_id is not null;

alter table public.agents enable row level security;

drop policy if exists "Authenticated users can manage agents" on public.agents;
drop policy if exists "Members manage their clinic's agents" on public.agents;
create policy "Members manage their clinic's agents"
  on public.agents for all
  to authenticated
  using (clinic_id in (select public.my_clinic_ids()))
  with check (clinic_id in (select public.my_clinic_ids()));

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
alter table public.calls
  add column if not exists clinic_id uuid references public.clinics (id) on delete cascade;

create index if not exists calls_clinic_started_idx on public.calls (clinic_id, started_at desc);

create index if not exists calls_created_at_idx on public.calls (created_at desc);
create index if not exists calls_agent_id_idx on public.calls (agent_id);

alter table public.calls enable row level security;

drop policy if exists "Authenticated users can read calls" on public.calls;
drop policy if exists "Members read their clinic's calls" on public.calls;
create policy "Members read their clinic's calls"
  on public.calls for select
  to authenticated
  using (clinic_id in (select public.my_clinic_ids()));

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
alter table public.crm_records
  add column if not exists clinic_id uuid references public.clinics (id) on delete cascade;

create index if not exists crm_records_clinic_created_idx on public.crm_records (clinic_id, created_at desc);

create index if not exists crm_records_created_at_idx on public.crm_records (created_at desc);
create index if not exists crm_records_caller_number_idx on public.crm_records (caller_number);

-- one crm_records row per call — lets the backfill sync (app/api/cron/crm-sync)
-- upsert on call_id without ever creating duplicates.
create unique index if not exists crm_records_call_id_idx on public.crm_records (call_id);

alter table public.crm_records enable row level security;

-- Inserts happen server-side only, from the Vapi webhook route, using the
-- service role key (which bypasses RLS). This policy just lets a clinic's
-- signed-in staff read their own clinic's log.
drop policy if exists "Authenticated users can read crm_records" on public.crm_records;
drop policy if exists "Members read their clinic's crm_records" on public.crm_records;
create policy "Members read their clinic's crm_records"
  on public.crm_records for select
  to authenticated
  using (clinic_id in (select public.my_clinic_ids()));

-- ─────────────────────────────────────────────────────────────────────────
--  demo_requests — the "Kliniğinizde deneyin" form (/demo-talep), read in
--  /admin → Demo talepleri. Inserts happen server-side only (service role
--  key bypasses RLS); no public policies on purpose — nobody, not even a
--  signed-in user, can list these through the API. It's a lead inbox, not
--  app data. (Replaces waitlist_emails, the retired /on-kayit list; older
--  databases may still have that table — nothing reads it.)
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.demo_requests (
  id uuid primary key default gen_random_uuid(),
  clinic_name text not null,
  contact_name text not null,
  phone text not null,
  email text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists demo_requests_created_at_idx on public.demo_requests (created_at desc);

alter table public.demo_requests enable row level security;

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
alter table public.appointments
  add column if not exists clinic_id uuid references public.clinics (id) on delete cascade;

-- Faz 3: set by n8n through /api/automation/reminders/sent, so a reminder
-- goes out once. Cleared again when the appointment is rescheduled.
alter table public.appointments
  add column if not exists reminder_24h_sent_at timestamptz;
alter table public.appointments
  add column if not exists reminder_2h_sent_at timestamptz;

create unique index if not exists appointments_call_id_idx on public.appointments (call_id);
create index if not exists appointments_starts_at_idx on public.appointments (starts_at);
create index if not exists appointments_clinic_starts_idx on public.appointments (clinic_id, starts_at);

alter table public.appointments enable row level security;

-- Writes happen server-side only, with the service role key (which bypasses
-- RLS). This policy just lets signed-in dashboard users read the schedule.
drop policy if exists "Authenticated users can read appointments" on public.appointments;
drop policy if exists "Members read their clinic's appointments" on public.appointments;
create policy "Members read their clinic's appointments"
  on public.appointments for select
  to authenticated
  using (clinic_id in (select public.my_clinic_ids()));

-- ─────────────────────────────────────────────────────────────────────────
--  Upgrade path from the single-clinic schema. Rows written before
--  clinic_id existed all belonged to the one team that deployment served,
--  so they move into one clinic ("İlk klinik"), and every account that
--  could see them before becomes a member of it — nobody loses access in
--  the upgrade. A no-op on a fresh install and on every later re-run.
-- ─────────────────────────────────────────────────────────────────────────

do $$
declare
  first_clinic uuid;
begin
  if exists (select 1 from public.agents where clinic_id is null)
     or exists (select 1 from public.calls where clinic_id is null)
     or exists (select 1 from public.crm_records where clinic_id is null)
     or exists (select 1 from public.appointments where clinic_id is null)
  then
    select id into first_clinic from public.clinics order by created_at limit 1;
    if first_clinic is null then
      insert into public.clinics (name) values ('İlk klinik') returning id into first_clinic;
    end if;

    update public.agents set clinic_id = first_clinic where clinic_id is null;
    update public.calls set clinic_id = first_clinic where clinic_id is null;
    update public.crm_records set clinic_id = first_clinic where clinic_id is null;
    update public.appointments set clinic_id = first_clinic where clinic_id is null;

    insert into public.clinic_members (clinic_id, user_id, role)
      select first_clinic, u.id, 'owner' from auth.users u
      on conflict do nothing;
  end if;
end $$;

-- Only after the backfill: from here on, a row without a clinic is a bug.
alter table public.agents alter column clinic_id set not null;
alter table public.calls alter column clinic_id set not null;
alter table public.crm_records alter column clinic_id set not null;
alter table public.appointments alter column clinic_id set not null;

-- ─────────────────────────────────────────────────────────────────────────
--  clinic_usage_since — minutes and calls per clinic since a moment, for
--  /admin's invoicing view (lib/admin/clinics.ts). An aggregate, so the
--  operator console never reads a call row itself; and in SQL because
--  PostgREST caps a response at 1,000 rows. Service role only.
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.clinic_usage_since(since timestamptz)
returns table (clinic_id uuid, seconds bigint, calls bigint)
language sql stable set search_path = ''
as $$
  select c.clinic_id, coalesce(sum(c.duration_sec), 0)::bigint, count(*)::bigint
  from public.calls c
  where c.started_at >= since
  group by c.clinic_id
$$;

revoke execute on function public.clinic_usage_since(timestamptz) from public, anon, authenticated;
grant execute on function public.clinic_usage_since(timestamptz) to service_role;

-- ─────────────────────────────────────────────────────────────────────────
--  clinic_knowledge — the clinic's own facts (services with prices,
--  doctors, address, FAQ), edited on /klinik and folded into every agent's
--  system prompt on each Vapi sync (lib/clinics/knowledge-shape.ts). One row
--  per clinic. Written only by app/api/clinic/knowledge (service role);
--  members may read their own.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.clinic_knowledge (
  clinic_id uuid primary key references public.clinics (id) on delete cascade,
  services jsonb not null default '[]'::jsonb,
  doctors jsonb not null default '[]'::jsonb,
  address text not null default '',
  faq text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

alter table public.clinic_knowledge enable row level security;

drop policy if exists "Members read their clinic's knowledge" on public.clinic_knowledge;
create policy "Members read their clinic's knowledge"
  on public.clinic_knowledge for select
  to authenticated
  using (clinic_id in (select public.my_clinic_ids()));

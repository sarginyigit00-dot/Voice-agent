import appConfig from "@/app.config";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * "Is anything broken?" for the /admin panel — the first place to look when a
 * feature silently falls back to demo mode or a table isn't reachable.
 *
 * Two rules this file keeps:
 *  · It reports whether a key is SET, never its value. Nothing here may return
 *    a secret to the browser.
 *  · Table checks are head-only reachability probes. It does not read rows
 *    from `calls` or `crm_records` — that content belongs to the clinic and we
 *    only hold it as a processor (app/gizlilik/page.tsx §2).
 */

export interface EnvCheck {
  name: string;
  set: boolean;
  optional?: boolean;
}

export interface IntegrationHealth {
  key: string;
  name: string;
  /** True when the integration has everything it needs to run for real. */
  connected: boolean;
  purpose: string;
  docsUrl: string;
  vars: EnvCheck[];
}

export interface TableHealth {
  name: string;
  ok: boolean;
  error: string | null;
}

export interface SystemHealth {
  integrations: IntegrationHealth[];
  /** Keys that aren't part of an integration but still switch features on. */
  extras: EnvCheck[];
  tables: TableHealth[];
  runtime: {
    env: string;
    appUrl: string | null;
    timezone: string;
    checkedAt: string;
  };
}

const isSet = (name: string) => Boolean(process.env[name]);

/** Env vars that gate a feature but don't belong to an app.config integration. */
const EXTRA_VARS: EnvCheck[] = [
  { name: "ADMIN_PASSWORD", set: false },
  { name: "SUPABASE_SERVICE_ROLE_KEY", set: false },
  { name: "CRON_SECRET", set: false },
  { name: "BOOKING_FALLBACK_EMAIL", set: false },
  { name: "CALCOM_EVENT_TYPE_ID", set: false },
  { name: "WAITLIST_WEBHOOK_URL", set: false, optional: true },
  { name: "CRM_WEBHOOK_URL", set: false, optional: true },
];

/** The tables supabase/schema.sql defines — a missing one means schema drift. */
const TABLES = ["agents", "calls", "crm_records", "appointments", "waitlist_emails"];

export async function getSystemHealth(): Promise<SystemHealth> {
  const integrations: IntegrationHealth[] = appConfig.integrations.map((i) => {
    const vars: EnvCheck[] = [
      ...i.envVars.map((name) => ({ name, set: isSet(name) })),
      ...(i.optionalEnvVars ?? []).map((name) => ({ name, set: isSet(name), optional: true })),
    ];
    const required = vars.filter((v) => !v.optional);
    // `anyOf` integrations (OpenAI *or* Anthropic) need one key, not all.
    const connected = i.anyOf ? required.some((v) => v.set) : required.every((v) => v.set);

    return {
      key: i.key,
      name: i.name,
      connected,
      purpose: i.purpose.tr,
      docsUrl: i.docsUrl,
      vars,
    };
  });

  const extras = EXTRA_VARS.map((v) => ({ ...v, set: isSet(v.name) }));

  return {
    integrations,
    extras,
    tables: await checkTables(),
    runtime: {
      env: process.env.NODE_ENV ?? "unknown",
      appUrl: process.env.NEXT_PUBLIC_APP_URL ?? null,
      timezone: process.env.BOOKING_TIMEZONE ?? "Europe/Istanbul",
      checkedAt: new Date().toISOString(),
    },
  };
}

async function checkTables(): Promise<TableHealth[]> {
  const supabase = getSupabaseServer();
  if (!supabase) {
    return TABLES.map((name) => ({ name, ok: false, error: "Supabase bağlı değil" }));
  }

  return Promise.all(
    TABLES.map(async (name) => {
      // head:true — asks for the count and no rows, so nothing readable comes back.
      const { error } = await supabase.from(name).select("id", { count: "exact", head: true });
      return { name, ok: !error, error: error?.message ?? null };
    }),
  );
}

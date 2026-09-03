import appConfig from "@/app.config";
import { SettingsClient } from "@/components/app/settings-client";

/**
 * Server side: an integration is "connected" when all its env vars exist.
 * We also report which individual keys are present so the client can show a
 * per-key chip instead of a single opaque "demo mode" label.
 */
export default function SettingsPage() {
  const keyStatus: Record<string, Record<string, boolean>> = {};
  for (const it of appConfig.integrations) {
    keyStatus[it.key] = Object.fromEntries(
      [...it.envVars, ...(it.optionalEnvVars ?? [])].map((v) => [v, !!process.env[v]]),
    );
  }
  return <SettingsClient keyStatus={keyStatus} />;
}

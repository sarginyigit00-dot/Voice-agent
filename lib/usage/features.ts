/**
 * The cockpit features usage_events counts, keyed by their top-level route
 * (the nav in app.config.ts). Shared by the ping route, which maps a path to
 * a key, and /admin → Özet, which shows the label.
 */
export const FEATURES = {
  dashboard: "Kokpit",
  calls: "Aramalar",
  randevular: "Randevular",
  agents: "Ajanlar",
  klinik: "Klinik",
  crm: "CRM",
  settings: "Ayarlar",
} as const;

export type FeatureId = keyof typeof FEATURES;

/** "/calls/abc" → "calls"; null for anything outside the list. */
export function featureForPath(path: string): FeatureId | null {
  const first = path.split(/[?#]/)[0].split("/").filter(Boolean)[0] ?? "";
  return first in FEATURES ? (first as FeatureId) : null;
}

export function featureLabel(id: string): string {
  return FEATURES[id as FeatureId] ?? id;
}

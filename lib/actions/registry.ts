import type { L } from "@/lib/i18n/config";

/**
 * Single source of truth for the 5 agent actions. Both the builder's toggle
 * list (lib/demo/data.ts → BUILDER_ACTIONS) and each Agent's enabled set
 * (Agent.actionIds) key off these ids instead of translated label text — a
 * label match breaks the moment the UI language changes.
 */
export const ACTION_IDS = ["book", "transfer", "sms", "crm", "qualify"] as const;
export type ActionId = (typeof ACTION_IDS)[number];

export const ACTION_LABEL: Record<ActionId, L> = {
  book: { tr: "Takvime randevu al", en: "Book to calendar" },
  transfer: { tr: "Canlı temsilciye transfer", en: "Transfer to a human" },
  sms: { tr: "Onay mesajı gönder (WhatsApp)", en: "Send confirmation (WhatsApp)" },
  crm: { tr: "CRM'e kaydet", en: "Log to CRM" },
  qualify: { tr: "Adayı nitelendir & puanla", en: "Qualify & score lead" },
};

/**
 * "transfer" isn't executed by a webhook after the call — Vapi performs it
 * live, mid-call, via a `transferCall` tool declared on the assistant. Its
 * executor (lib/actions/executors/transfer.ts) only reports whether the call
 * was handed over, and the builder UI surfaces this note next to the toggle.
 */
export const ACTION_HINT: Partial<Record<ActionId, L>> = {
  transfer: {
    tr: "Arayan hattı kapatmadan, görüşmenin ortasında canlı olarak aktarılır.",
    en: "The caller is handed over live, mid-call, without hanging up.",
  },
};

export const DEFAULT_ACTIONS_ON: Record<ActionId, boolean> = {
  book: true,
  transfer: true,
  sms: true,
  crm: false,
  qualify: false,
};

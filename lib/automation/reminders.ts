const MIN = 60 * 1000;
export const HOUR = 60 * MIN;

/**
 * The two WhatsApp reminders, shared by /api/automation/due-reminders (what
 * is due) and /api/automation/reminders/sent (mark it done).
 *
 * - `24h`: starts in (3 h, 24 h] — anything sooner only gets the 2 h one.
 * - `2h`:  starts in (15 min, 2 h].
 */
export const REMINDER_WINDOWS = {
  "24h": { from: 3 * HOUR, to: 24 * HOUR, column: "reminder_24h_sent_at" },
  "2h": { from: 15 * MIN, to: 2 * HOUR, column: "reminder_2h_sent_at" },
} as const;

export type ReminderKind = keyof typeof REMINDER_WINDOWS;

export const isReminderKind = (v: unknown): v is ReminderKind => v === "24h" || v === "2h";

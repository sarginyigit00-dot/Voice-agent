/**
 * Appointment times as a patient reads them, in the clinic's own time zone —
 * n8n drops these straight into SMS text and WhatsApp template variables, so it never has
 * to do time-zone arithmetic of its own.
 */
export function localParts(iso: string, timeZone: string): { date: string; time: string } {
  const d = new Date(iso);
  const tz = timeZone || "Europe/Istanbul";
  return {
    // "15 Eylül Salı"
    date: new Intl.DateTimeFormat("tr-TR", { timeZone: tz, day: "numeric", month: "long", weekday: "long" }).format(d),
    // "14:30"
    time: new Intl.DateTimeFormat("tr-TR", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(d),
  };
}

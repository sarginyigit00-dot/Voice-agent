/** A row in the internal `crm_records` table (see supabase/schema.sql). */
export interface CrmRecord {
  id: string;
  call_id: string;
  agent_id: string;
  agent_name: string;
  caller_name: string;
  caller_number: string;
  started_at: string;
  duration_sec: number;
  outcome: string;
  summary: string;
  transcript: { speaker: string; text: string; atSec: number }[];
  /**
   * Human-readable notes from the post-call actions that ran ("Randevu
   * eklendi — Per 15:30"). Optional because rows written before the column
   * existed — and rows the webhook writes in real time — come back without
   * it; the cron sync fills those in. See lib/crm/sync.ts.
   */
  actions?: string[];
  created_at: string;
}

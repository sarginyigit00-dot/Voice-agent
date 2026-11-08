import type { Agent } from "@/lib/demo/data";
import { DAY_LABEL, findOverlap, type HoursOverlap } from "@/lib/agents/hours";

/**
 * One active agent per hour. Two "Aktif" agents on the same hours read as
 * "both answer the phone" — they don't (lib/vapi/routing.ts picks one), but
 * the clinic can't tell. So an agent can't be switched on, or saved with new
 * hours, while another active agent already covers any of them.
 *
 * Panel-side rule (agents are written from the browser under RLS); used by
 * /agents and the dashboard's agent toggles alike.
 */

export interface AgentConflict {
  agent: Agent;
  overlap: HoursOverlap;
}

/** The other active agent `candidate` would share hours with, if any. */
export function conflictFor(candidate: Agent, agents: Agent[]): AgentConflict | null {
  for (const other of agents) {
    if (other.id === candidate.id || !other.active) continue;
    const overlap = findOverlap(candidate.workingHours, other.workingHours);
    if (overlap) return { agent: other, overlap };
  }
  return null;
}

export function describeConflict(c: AgentConflict, lang: "tr" | "en"): string {
  const span = `${DAY_LABEL[c.overlap.day][lang]} ${c.overlap.from}–${c.overlap.to}`;
  return lang === "tr"
    ? `Bu saatte "${c.agent.name}" zaten çalışıyor (${span}). Önce onu duraklatın ya da saatleri ayırın.`
    : `"${c.agent.name}" already works at this time (${span}). Pause it first or split the hours.`;
}

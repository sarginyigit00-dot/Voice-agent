"use client";

import { authedFetch } from "@/lib/supabase/authed-fetch";
import { normalizeKnowledge, type ClinicKnowledge } from "@/lib/clinics/knowledge-shape";

/** /klinik's reads and writes, through app/api/clinic/knowledge (which re-syncs the agents). */

export async function fetchKnowledge(): Promise<ClinicKnowledge | null> {
  try {
    const res = await authedFetch("/api/clinic/knowledge");
    if (!res.ok) return null;
    const body = await res.json();
    return normalizeKnowledge(body?.knowledge);
  } catch {
    return null;
  }
}

export interface SaveKnowledgeResult {
  ok: boolean;
  error?: string;
  knowledge?: ClinicKnowledge;
  synced?: number;
  failed?: { name: string; message: string }[];
}

export async function saveKnowledgeRemote(knowledge: ClinicKnowledge): Promise<SaveKnowledgeResult> {
  try {
    const res = await authedFetch("/api/clinic/knowledge", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ knowledge }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: body?.error ?? `Kaydedilemedi (${res.status}).` };
    return {
      ok: true,
      knowledge: normalizeKnowledge(body?.knowledge),
      synced: body?.synced ?? 0,
      failed: body?.failed ?? [],
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

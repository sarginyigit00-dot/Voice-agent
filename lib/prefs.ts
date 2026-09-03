"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Cockpit preferences. Demo mode has no backend, so these live in
 * localStorage — but more than one component reads them (the settings page and
 * the footer status bar), so writes broadcast an event to keep every mounted
 * control in sync instead of drifting apart.
 */
export const PREFS_KEY = "randevox:prefs";
const PREFS_EVENT = "randevox:prefs-change";

export interface Prefs {
  recording: boolean;
  notifications: boolean;
  liveTicker: boolean;
}

export const DEFAULT_PREFS: Prefs = {
  recording: true,
  notifications: true,
  liveTicker: true,
};

export function readPrefs(): Prefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

export function writePrefs(prefs: Prefs) {
  window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  window.dispatchEvent(new Event(PREFS_EVENT));
}

/**
 * Reads the saved prefs. Starts from the defaults so server and client render
 * the same markup, then syncs on mount and on every write from anywhere.
 */
export function usePrefs() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);

  useEffect(() => {
    const sync = () => setPrefs(readPrefs());
    sync();
    window.addEventListener(PREFS_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(PREFS_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const update = useCallback((patch: Partial<Prefs>) => {
    const next = { ...readPrefs(), ...patch };
    writePrefs(next);
    setPrefs(next);
  }, []);

  return { prefs, update };
}

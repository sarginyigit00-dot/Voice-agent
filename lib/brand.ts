"use client";

import { useSyncExternalStore } from "react";

/**
 * The brand overrides the user typed on the settings page. Demo mode has no
 * backend, so they live in localStorage and are read through
 * useSyncExternalStore — that keeps the value *derived* instead of copied into
 * state inside an effect, so there is no cascading re-render on mount.
 */
export const BRAND_KEY = "randevox:brand";
const BRAND_EVENT = "randevox:brand-change";

export interface Brand {
  name: string;
  domain: string;
  tagline: string;
}

// useSyncExternalStore compares snapshots by identity, so the parsed object has
// to be cached and only rebuilt when the raw string actually changes.
let cachedRaw: string | null = null;
let cachedBrand: Brand | null = null;

function getSnapshot(): Brand | null {
  const raw = window.localStorage.getItem(BRAND_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      cachedBrand = raw ? (JSON.parse(raw) as Brand) : null;
    } catch {
      cachedBrand = null;
    }
  }
  return cachedBrand;
}

function subscribe(onChange: () => void) {
  window.addEventListener(BRAND_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(BRAND_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function saveBrand(brand: Brand) {
  window.localStorage.setItem(BRAND_KEY, JSON.stringify(brand));
  window.dispatchEvent(new Event(BRAND_EVENT));
}

export function clearBrand() {
  window.localStorage.removeItem(BRAND_KEY);
  window.dispatchEvent(new Event(BRAND_EVENT));
}

/** The saved brand, or null when the user has never overridden it. */
export function useStoredBrand(): Brand | null {
  // The server has no localStorage — it always renders the config defaults.
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}

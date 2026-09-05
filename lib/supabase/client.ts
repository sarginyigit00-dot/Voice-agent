"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let cached: SupabaseClient | null = null;

/** True once the two public env vars are set — the app falls back to the demo bypass when they aren't. */
export const isSupabaseConfigured = Boolean(url && anonKey);

/**
 * Where the signed-in session is kept, as chosen by the login screen's
 * "remember me" box. "0" means this browser session only.
 */
const PERSIST_KEY = "randevox:persist";

/** Supabase writes its token under an `sb-<project-ref>-auth-token` key. */
const SB_PREFIX = "sb-";

function persists(): boolean {
  try {
    return localStorage.getItem(PERSIST_KEY) !== "0";
  } catch {
    // Private mode / storage blocked — degrade to the in-tab store.
    return false;
  }
}

/** Drops every Supabase auth key from one store, so no stale token survives a switch. */
function purge(store: Storage) {
  try {
    for (const key of Object.keys(store)) {
      if (key.startsWith(SB_PREFIX)) store.removeItem(key);
    }
  } catch {
    /* storage blocked — nothing to purge */
  }
}

/**
 * Called by the auth screen BEFORE it signs in, so the token that sign-in is
 * about to write lands in the right store:
 *
 * - remembered   → localStorage, survives closing the browser (the default)
 * - not remembered → sessionStorage, gone when the tab/browser closes
 *
 * The other store is purged either way — a leftover token in localStorage
 * would silently sign the next visitor back in on a shared clinic computer.
 */
export function setSessionPersistence(remember: boolean) {
  try {
    if (remember) localStorage.setItem(PERSIST_KEY, "1");
    else localStorage.setItem(PERSIST_KEY, "0");
  } catch {
    /* storage blocked — the adapter falls back to sessionStorage */
  }
  purge(remember ? sessionStorage : localStorage);
}

/** What the "remember me" box should show when the login screen mounts. */
export function getSessionPersistence(): boolean {
  return persists();
}

/**
 * Routes supabase-js at whichever store the current choice points to. The
 * decision is read on every call rather than at client-creation time, because
 * the client is created (and cached) long before the visitor ticks the box.
 */
const hybridStorage = {
  getItem: (key: string) => {
    try {
      return (persists() ? localStorage : sessionStorage).getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string) => {
    try {
      (persists() ? localStorage : sessionStorage).setItem(key, value);
    } catch {
      /* storage blocked — the session just won't survive a reload */
    }
  },
  // Signing out has to clear both, never only the active one.
  removeItem: (key: string) => {
    try {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    } catch {
      /* storage blocked — nothing to remove */
    }
  },
};

/**
 * Browser Supabase client used for auth (sign in / sign up / session).
 * The session is refreshed automatically and kept in localStorage (or, when
 * "remember me" is off, sessionStorage), so no middleware is needed — every
 * guarded surface is a client component.
 * Returns null in demo mode so callers can degrade instead of throwing.
 */
export function getSupabaseBrowser(): SupabaseClient | null {
  if (!url || !anonKey) return null;
  if (!cached) {
    cached = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: hybridStorage,
      },
    });
  }
  return cached;
}

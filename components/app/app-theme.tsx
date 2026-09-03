"use client";

import { createContext, useCallback, useContext, useSyncExternalStore, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The cockpit's own light/dark switch — deliberately separate from the
 * site-wide theme that next-themes drives via `.dark` on <html>. That global
 * state defaults to dark and is what the rest of the dark cockpit relies on;
 * nothing here touches it.
 *
 * The panel instead defaults to the light editorial palette (`.ed-light`)
 * regardless of the global theme. Toggling here just stops applying that
 * override, which lets `.dark` — always present on <html> since nothing else
 * in the app calls next-themes' `setTheme` away from it — cascade through and
 * restore the original near-black cockpit. No dark values are redefined a
 * second time; the ones `.dark` already provides are correct.
 */
const STORAGE_KEY = "randevox:app-theme";
const EVENT = "randevox:app-theme-change";

function getSnapshot(): boolean {
  return window.localStorage.getItem(STORAGE_KEY) === "dark";
}
function getServerSnapshot(): boolean {
  return false;
}
function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

interface AppThemeCtx {
  isDark: boolean;
  toggle: () => void;
}

const AppThemeContext = createContext<AppThemeCtx | null>(null);

export function AppThemeProvider({ children }: { children: ReactNode }) {
  // useSyncExternalStore (not useState+useEffect) so the server and the first
  // client render agree — "light" — with no cascading setState after mount.
  const isDark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = useCallback(() => {
    window.localStorage.setItem(STORAGE_KEY, isDark ? "light" : "dark");
    window.dispatchEvent(new Event(EVENT));
  }, [isDark]);

  return (
    <AppThemeContext.Provider value={{ isDark, toggle }}>
      <div className={cn("flex h-dvh flex-col overflow-hidden", !isDark && "ed-light")}>
        {children}
      </div>
    </AppThemeContext.Provider>
  );
}

export function useAppTheme(): AppThemeCtx {
  const ctx = useContext(AppThemeContext);
  if (!ctx) throw new Error("useAppTheme must be used within AppThemeProvider");
  return ctx;
}

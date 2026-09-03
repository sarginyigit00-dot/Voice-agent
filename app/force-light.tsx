"use client";

import { useLayoutEffect } from "react";

/**
 * The landing page is light-only, but the site is dark-first (`defaultTheme="dark"`
 * on <html>, body painted with `bg-background`). Only the inner `.ed-light`
 * div was getting the light palette, so scroll overscroll/rubber-band at the
 * top or bottom edge flashed the dark cockpit background through underneath
 * it. Forcing `.ed-light` onto <html> itself for as long as this route is
 * mounted fixes that at the source, without touching the global theme state
 * other routes rely on.
 */
export function ForceLightRoute() {
  useLayoutEffect(() => {
    const html = document.documentElement;
    const hadDark = html.classList.contains("dark");
    html.classList.remove("dark");
    html.classList.add("ed-light");
    return () => {
      html.classList.remove("ed-light");
      if (hadDark) html.classList.add("dark");
    };
  }, []);

  return null;
}

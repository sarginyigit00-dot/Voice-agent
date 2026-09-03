"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * False while server-rendering and during the first client render, true after
 * hydration. Use it to gate anything the server can't know (the resolved theme,
 * localStorage) without a setState-in-effect and the extra render it costs.
 */
export function useMounted() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

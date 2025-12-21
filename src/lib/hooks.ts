"use client";

import { useSyncExternalStore } from "react";

/**
 * A no-op subscribe function for client-only state.
 * The mounted state never changes after initial hydration.
 */
function subscribe() {
  return () => {};
}

/**
 * Returns true on the client after hydration, false during SSR.
 * Uses useSyncExternalStore to avoid hydration mismatches and
 * comply with React Compiler rules about refs during render.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,  // Client snapshot: always true after hydration
    () => false  // Server snapshot: always false during SSR
  );
}


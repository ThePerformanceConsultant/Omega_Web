"use client";

import { useSyncExternalStore, useCallback } from "react";

function getServerSnapshot() {
  return null;
}

export function useLocalStorage<T>(key: string, initialValue: T): [T, (v: T) => void] {
  // Read from localStorage synchronously via useSyncExternalStore (avoids set-state-in-effect)
  const stored = useSyncExternalStore(
    useCallback(
      (onStoreChange: () => void) => {
        const handler = (e: StorageEvent) => {
          if (e.key === key) onStoreChange();
        };
        window.addEventListener("storage", handler);
        return () => window.removeEventListener("storage", handler);
      },
      [key]
    ),
    () => {
      try {
        const item = window.localStorage.getItem(key);
        return item !== null ? (JSON.parse(item) as T) : null;
      } catch {
        return null;
      }
    },
    getServerSnapshot
  );

  const value = stored ?? initialValue;

  const setValue = (v: T) => {
    try {
      window.localStorage.setItem(key, JSON.stringify(v));
      // Trigger re-render by dispatching a storage event (same-window)
      window.dispatchEvent(new StorageEvent("storage", { key }));
    } catch {
      // Ignore storage errors
    }
  };

  return [value, setValue];
}

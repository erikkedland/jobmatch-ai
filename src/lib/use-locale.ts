"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { isLocale, messages, type Locale } from "./i18n";

const STORAGE_KEY = "jobmatch-locale";
const listeners = new Set<() => void>();
/** In-memory choice, so switching works even when localStorage is blocked. */
let chosen: Locale | null = null;

function readLocale(): Locale {
  if (chosen) return chosen;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLocale(saved)) return saved;
  } catch {
    // Storage can be blocked (private mode); fall back to the browser language.
  }
  return navigator.language.toLowerCase().startsWith("sv") ? "sv" : "en";
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Current UI language, persisted per browser. Renders English on the server. */
export function useLocale() {
  const locale = useSyncExternalStore(subscribe, readLocale, () => "en" as Locale);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    chosen = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not persisted, but still switch for this page view.
    }
    listeners.forEach((l) => l());
  }, []);

  return { locale, t: messages[locale], setLocale };
}

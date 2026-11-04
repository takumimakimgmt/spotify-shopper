"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { STORAGE_KEYS } from "../storage/keys";
import messages from "./ja.json";
export type Language = "en" | "ja";
export const LANGUAGE_KEY = STORAGE_KEYS.language;
type Values = Record<string, string | number>;
export function translate(
  language: Language,
  message: string,
  values: Values = {},
): string {
  const key = message.trim();
  const translated =
    language === "ja" ? (messages as Record<string, string>)[key] : undefined;
  const template =
    translated == null
      ? message
      : `${message.match(/^\s*/)?.[0] || ""}${translated}${message.match(/\s*$/)?.[0] || ""}`;
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    String(values[name] ?? match),
  );
}
const Context = createContext({
  language: "en" as Language,
  setLanguage: (_language: Language) => {},
  t: (message: string, values?: Values) => translate("en", message, values),
  warning: null as string | null,
});
function initialLanguage(): Language {
  try {
    const saved = localStorage.getItem(LANGUAGE_KEY);
    if (saved === "ja" || saved === "en") return saved;
  } catch {
    /* Browser preference is usable even when storage is unavailable. */
  }
  return navigator.languages?.[0]?.toLowerCase().startsWith("ja") ||
    navigator.language.toLowerCase().startsWith("ja")
    ? "ja"
    : "en";
}
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const restoreTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [language, updateLanguage] = useState<Language>("en");
  const [warning, setWarning] = useState<string | null>(null);
  useEffect(() => {
    restoreTimer.current = setTimeout(() => {
      restoreTimer.current = null;
      updateLanguage(initialLanguage());
    }, 0);
    const onStorage = (event: StorageEvent) => {
      if (
        event.key === LANGUAGE_KEY &&
        (event.newValue === "ja" || event.newValue === "en")
      ) {
        if (restoreTimer.current) clearTimeout(restoreTimer.current);
        restoreTimer.current = null;
        updateLanguage(event.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      if (restoreTimer.current) clearTimeout(restoreTimer.current);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  const setLanguage = useCallback((next: Language) => {
    if (restoreTimer.current) clearTimeout(restoreTimer.current);
    restoreTimer.current = null;
    updateLanguage(next);
    try {
      localStorage.setItem(LANGUAGE_KEY, next);
      setWarning(null);
    } catch {
      setWarning(
        "Language preference could not be saved. It will apply for this page only.",
      );
    }
  }, []);
  const value = useMemo(
    () => ({
      language,
      setLanguage,
      warning,
      t: (message: string, values?: Values) =>
        translate(language, message, values),
    }),
    [language, setLanguage, warning],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useI18n() {
  return useContext(Context);
}

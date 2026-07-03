"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { defaultLocale, isLocale, localeLabels, locales, t as translate, type Locale, type TranslationKey } from "./translations";

const storageKey = "ultilog.locale";

type I18nContextValue = {
  locale: Locale;
  locales: Locale[];
  localeLabels: Record<Locale, string>;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window === "undefined") return defaultLocale;
    const storedLocale = window.localStorage.getItem(storageKey);
    return isLocale(storedLocale) ? storedLocale : defaultLocale;
  });

  useEffect(() => {
    document.documentElement.lang = locale;
    window.localStorage.setItem(storageKey, locale);
  }, [locale]);

  const value = useMemo<I18nContextValue>(() => ({
    locale,
    locales,
    localeLabels,
    setLocale: setLocaleState,
    t: (key) => translate(locale, key),
  }), [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used within I18nProvider");
  return context;
}

export function LocaleSelect({ className }: { className?: string }) {
  const { locale, locales, localeLabels, setLocale, t } = useI18n();
  return (
    <label className={className}>
      <span>{t("locale.label")}</span>
      <select value={locale} onChange={(event) => setLocale(event.target.value as Locale)} aria-label={t("locale.label")}>
        {locales.map((candidate) => <option key={candidate} value={candidate}>{localeLabels[candidate]}</option>)}
      </select>
    </label>
  );
}

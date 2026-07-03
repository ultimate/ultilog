import { de } from "./dictionaries/de";
import { en, type Dictionary, type TranslationKey } from "./dictionaries/en";
import { fr } from "./dictionaries/fr";
import { it } from "./dictionaries/it";

export const defaultLocale = "en" as const;
export type Locale = "en" | "de" | "fr" | "it";
export type { Dictionary, TranslationKey };

export const locales: Locale[] = ["en", "de", "fr", "it"];
export const localeLabels: Record<Locale, string> = {
  en: "English",
  de: "Deutsch",
  fr: "Français",
  it: "Italiano",
};

export const dictionaries: Record<Locale, Dictionary> = {
  en,
  de,
  fr,
  it,
};

export const translations = dictionaries;

export function isLocale(value: string | null | undefined): value is Locale {
  return Boolean(value && locales.includes(value as Locale));
}

export function t(locale: Locale, key: TranslationKey) {
  return dictionaries[locale][key];
}

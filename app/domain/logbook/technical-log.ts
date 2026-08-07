import type { TechnicalCheck } from "../../models/log-sheet";
import type { Locale } from "../../lib/i18n";

export const TECHNICAL_CHECK_STATUSES = ["✅", "❎", "⚠️", "❌", "❗", "❓", "ℹ️", "🆗", "🆖", "0️⃣", "1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟", "⌛", "○", "◔", "◑", "◕", "●"] as const;
export const DEFAULT_TECHNICAL_CHECK_STATUS = "⌛";

const standardTemplates: Record<Locale, string[]> = {
  en: ["Engine oil", "Engine cooling water", "Diesel / fuel fill level", "Drinking water fill level", "Motor battery", "Auxiliary battery", "Rigs"],
  de: ["Motoröl", "Motorkühlwasser", "Diesel- / Kraftstofffüllstand", "Trinkwasserfüllstand", "Motorbatterie", "Verbraucherbatterie", "Rigg"],
  fr: ["Huile moteur", "Eau de refroidissement moteur", "Niveau de diesel / carburant", "Niveau d’eau potable", "Batterie moteur", "Batterie auxiliaire", "Gréement"],
  it: ["Olio motore", "Acqua di raffreddamento motore", "Livello diesel / carburante", "Livello acqua potabile", "Batteria motore", "Batteria ausiliaria", "Sartiame"],
};

export const standardTechnicalLogTemplate = (locale: Locale): readonly string[] => standardTemplates[locale] ?? standardTemplates.en;

export function createTechnicalChecks(locale: Locale, customLines: readonly string[] = []): TechnicalCheck[] {
  return [...standardTechnicalLogTemplate(locale), ...customLines].map((text) => text.trim()).filter(Boolean)
    .map((text) => ({ status: DEFAULT_TECHNICAL_CHECK_STATUS, text }));
}

export function normalizeTechnicalCheck(value: unknown): TechnicalCheck | undefined {
  if (typeof value === "string") return value.trim() ? { status: DEFAULT_TECHNICAL_CHECK_STATUS, text: value.trim() } : undefined;
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Partial<TechnicalCheck>;
  const text = typeof candidate.text === "string" ? candidate.text.trim() : "";
  if (!text) return undefined;
  const status = typeof candidate.status === "string" && (TECHNICAL_CHECK_STATUSES as readonly string[]).includes(candidate.status) ? candidate.status : DEFAULT_TECHNICAL_CHECK_STATUS;
  return { status, text };
}

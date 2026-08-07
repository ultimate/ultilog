import type { Locale } from "../../lib/i18n";
import type { TechnicalCheck } from "../../models/log-sheet";

export const TECHNICAL_CHECK_STATUSES = ["⌛", "✅", "❎", "⚠️", "❌", "❗", "❓", "ℹ️", "🆗", "🆖", "0️⃣", "1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟", "○", "◔", "◑", "◕", "●"] as const;
export const DEFAULT_TECHNICAL_CHECK_STATUS = "⌛";

export const STANDARD_TECHNICAL_CHECK_IDS = ["engineOil", "engineWater", "fuelLevel", "drinkingWaterLevel", "motorBattery", "auxiliaryBattery", "rigs"] as const;
export type StandardTechnicalCheckId = typeof STANDARD_TECHNICAL_CHECK_IDS[number];
export type StandardTechnicalCheck = { id: StandardTechnicalCheckId; text: string };

const standardLabels: Record<Locale, Record<StandardTechnicalCheckId, string>> = {
  en: { engineOil: "Engine oil", engineWater: "Engine cooling water", fuelLevel: "Diesel / fuel fill level", drinkingWaterLevel: "Drinking water fill level", motorBattery: "Motor battery", auxiliaryBattery: "Auxiliary battery", rigs: "Rigs" },
  de: { engineOil: "Motoröl", engineWater: "Motorkühlwasser", fuelLevel: "Diesel- / Kraftstofffüllstand", drinkingWaterLevel: "Trinkwasserfüllstand", motorBattery: "Motorbatterie", auxiliaryBattery: "Verbraucherbatterie", rigs: "Rigg" },
  fr: { engineOil: "Huile moteur", engineWater: "Eau de refroidissement moteur", fuelLevel: "Niveau de diesel / carburant", drinkingWaterLevel: "Niveau d’eau potable", motorBattery: "Batterie moteur", auxiliaryBattery: "Batterie auxiliaire", rigs: "Gréement" },
  it: { engineOil: "Olio motore", engineWater: "Acqua di raffreddamento motore", fuelLevel: "Livello diesel / carburante", drinkingWaterLevel: "Livello acqua potabile", motorBattery: "Batteria motore", auxiliaryBattery: "Batteria ausiliaria", rigs: "Sartiame" },
};

export function normalizeStandardTechnicalCheckIds(value: unknown, fallback: readonly StandardTechnicalCheckId[] = STANDARD_TECHNICAL_CHECK_IDS): StandardTechnicalCheckId[] {
  if (!Array.isArray(value)) return [...fallback];
  const allowed = new Set<string>(STANDARD_TECHNICAL_CHECK_IDS);
  return [...new Set(value.filter((id): id is StandardTechnicalCheckId => typeof id === "string" && allowed.has(id)))];
}

export function standardTechnicalLogTemplate(locale: Locale, enabledIds: readonly StandardTechnicalCheckId[] = STANDARD_TECHNICAL_CHECK_IDS): StandardTechnicalCheck[] {
  const labels = standardLabels[locale] ?? standardLabels.en;
  return enabledIds.map((id) => ({ id, text: labels[id] })).filter((check) => Boolean(check.text));
}

export function createTechnicalChecks(locale: Locale, customLines: readonly string[] = [], enabledIds: readonly StandardTechnicalCheckId[] = STANDARD_TECHNICAL_CHECK_IDS): TechnicalCheck[] {
  return [...standardTechnicalLogTemplate(locale, enabledIds).map(({ text }) => text), ...customLines]
    .map((text) => text.trim()).filter(Boolean).map((text) => ({ status: DEFAULT_TECHNICAL_CHECK_STATUS, text }));
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

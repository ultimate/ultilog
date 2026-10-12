import type { TranslationKey } from "../../lib/i18n";

export const compassDirections = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"] as const;

export function translatedWindDirection(direction: string | undefined, t: (key: TranslationKey) => string) {
  const known = compassDirections.find(value => value === direction);
  return known ? t(`wind.direction.${known}`) : direction;
}

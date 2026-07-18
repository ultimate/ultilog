import { describe, expect, it } from "vitest";
import { locales, t, type Locale, type TranslationKey } from "../../app/lib/i18n";

const meteoReasonKeys = [
  "meteo.reason.noFreshNdbcObservation",
  "meteo.reason.noCoopsStationNearby",
  "meteo.reason.noCoopsWaterLevel",
  "meteo.reason.metarStationIdsRequired",
  "meteo.reason.noFreshMetarObservation",
  "meteo.reason.openMeteoFallbackSkipped",
  "meteo.reason.openMeteoFallbackEstimate",
  "meteo.reason.localAstronomyCalculated",
  "meteo.reason.metarAirportBased",
] as const satisfies readonly TranslationKey[];

const meteoFieldKeys = [
  "meteo.field.cloudCover",
  "meteo.field.weatherCondition",
  "meteo.field.barometer",
  "meteo.field.temperature",
  "meteo.field.windDirection",
  "meteo.field.windSpeed",
  "meteo.field.waveHeight",
  "meteo.field.tideHeight",
  "meteo.field.moonPhase",
] as const satisfies readonly TranslationKey[];

describe("meteo i18n keys", () => {
  it("translates meteo reason and field keys in every supported locale", () => {
    for (const locale of locales) {
      expectTranslated(locale, meteoReasonKeys);
      expectTranslated(locale, meteoFieldKeys);
    }
  });
});

function expectTranslated(locale: Locale, keys: readonly TranslationKey[]) {
  for (const key of keys) {
    expect(t(locale, key), `${locale} ${key}`).toBeTruthy();
  }
}

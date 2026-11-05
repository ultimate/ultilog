import { describe, expect, it } from "vitest";
import { configuredOpenMeteo } from "../../app/lib/meteo-configuration";
import { createFreeMeteoProviders } from "../../app/domain/meteo/default-service";

describe("Open-Meteo service eligibility", () => {
  it.each([{ OPEN_METEO_MODE: "disabled" }, { OPEN_METEO_MODE: "typo" },
    { OPEN_METEO_MODE: "commercial" }, { OPEN_METEO_MODE: "commercial", OPEN_METEO_API_KEY: " " }])("keeps disabled or misconfigured deployments off: %j", (env) => {
    const providers = createFreeMeteoProviders({ openMeteo: configuredOpenMeteo(env) });
    expect(providers.some((provider) => provider.name === "open-meteo")).toBe(false);
  });
  it("defaults to the confirmed non-commercial mode", () => {
    expect(configuredOpenMeteo({})).toEqual({});
    expect(configuredOpenMeteo({ OPEN_METEO_API_KEY: "key-without-mode" })).toEqual({});
  });
  it("enables explicitly eligible public use", () => {
    expect(configuredOpenMeteo({ OPEN_METEO_MODE: "non-commercial" })).toEqual({});
  });
  it("passes commercial credentials only in commercial mode", () => {
    expect(configuredOpenMeteo({ OPEN_METEO_MODE: "commercial", OPEN_METEO_API_KEY: " key " })).toEqual({ apiKey: "key" });
    expect(configuredOpenMeteo({ OPEN_METEO_MODE: "non-commercial", OPEN_METEO_API_KEY: "key" })).toEqual({});
  });
});

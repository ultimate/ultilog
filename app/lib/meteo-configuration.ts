import type { OpenMeteoProviderOptions } from "../domain/meteo/open-meteo";

// The operator has confirmed that this application currently runs non-commercially.
export const DEFAULT_OPEN_METEO_MODE = "non-commercial";

/** Explicit disabled/invalid modes and missing commercial keys remain fail-closed. */
export function configuredOpenMeteo(environment: { OPEN_METEO_MODE?: string; OPEN_METEO_API_KEY?: string; [key: string]: string | undefined }): OpenMeteoProviderOptions | undefined {
  const mode = environment.OPEN_METEO_MODE ?? DEFAULT_OPEN_METEO_MODE;
  if (mode === "non-commercial") return {};
  if (mode === "commercial" && environment.OPEN_METEO_API_KEY?.trim()) {
    return { apiKey: environment.OPEN_METEO_API_KEY.trim() };
  }
  // Disabled, invalid mode, or missing commercial credentials: never fall back to the free API.
  return undefined;
}

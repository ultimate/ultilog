import type { MeteoProvider, MeteoProviderContext } from "./provider";
import { createMeteoProvider } from "./provider";
import type { MeteoSource, MeteoValueProvenance } from "./types";

const forecastEndpoint = "https://api.open-meteo.com/v1/forecast";
const marineEndpoint = "https://marine-api.open-meteo.com/v1/marine";

export type OpenMeteoProviderOptions = {
  fetcher?: typeof fetch;
  forecastEndpoint?: string;
  marineEndpoint?: string;
};

type OpenMeteoResponse = {
  current?: Record<string, unknown>;
  current_units?: Record<string, string>;
  hourly?: Record<string, unknown[]>;
  hourly_units?: Record<string, string>;
  utc_offset_seconds?: number;
  timezone?: string;
};

export function createOpenMeteoProvider(options: OpenMeteoProviderOptions = {}): MeteoProvider {
  const fetcher = options.fetcher ?? fetch;
  const weatherSource = options.forecastEndpoint ?? forecastEndpoint;
  const seaSource = options.marineEndpoint ?? marineEndpoint;

  return createMeteoProvider({
    name: "open-meteo",
    label: "Open-Meteo",
    sourceType: "fallback",
    capabilities: { weather: true, wind: true, sea: true },
    async getSnapshot(context) {
      if (!context.allowFallbackEstimate) {
        return { warnings: [{ code: "meteo.reason.openMeteoFallbackSkipped" }] };
      }

      const [weather, marine] = await Promise.all([
        fetchOpenMeteoWeather(context, fetcher, weatherSource),
        fetchOpenMeteoMarine(context, fetcher, seaSource),
      ]);
      const weatherProvenance = openMeteoProvenance(context, weatherSource, weather.validAt);
      const marineProvenance = openMeteoProvenance(context, seaSource, marine.validAt);
      const sources = [
        openMeteoSource(context, weatherSource, weather.validAt),
        openMeteoSource(context, seaSource, marine.validAt),
      ];

      return {
        validAt: weather.validAt ?? marine.validAt ?? context.timestamp,
        weather: {
          cloudCoverPercent: value(numberField(weather.current.cloud_cover), "%", weatherProvenance),
          condition: value(weatherCodeDescription(numberField(weather.current.weather_code)), "text", weatherProvenance),
          pressureHpa: value(numberField(weather.current.pressure_msl) ?? numberField(weather.current.surface_pressure), "hPa", weatherProvenance),
          temperatureC: value(numberField(weather.current.temperature_2m), "c", weatherProvenance),
          humidityPercent: value(numberField(weather.current.relative_humidity_2m), "%", weatherProvenance),
          precipitationMm: value(numberField(weather.current.precipitation), "mm", weatherProvenance),
        },
        wind: {
          directionDeg: value(numberField(weather.current.wind_direction_10m), "deg", weatherProvenance),
          speedKnots: value(numberField(weather.current.wind_speed_10m), "kn", weatherProvenance),
          gustKnots: value(numberField(weather.current.wind_gusts_10m), "kn", weatherProvenance),
        },
        sea: {
          waveHeightM: value(numberField(marine.current.wave_height), "m", marineProvenance),
          waveDirectionDeg: value(numberField(marine.current.wave_direction), "deg", marineProvenance),
          wavePeriodS: value(numberField(marine.current.wave_period), "s", marineProvenance),
          swellHeightM: value(numberField(marine.current.swell_wave_height), "m", marineProvenance),
          swellDirectionDeg: value(numberField(marine.current.swell_wave_direction), "deg", marineProvenance),
          swellPeriodS: value(numberField(marine.current.swell_wave_period), "s", marineProvenance),
        },
        sources,
        warnings: [{ code: "meteo.reason.openMeteoFallbackEstimate" }],
      };
    },
  });
}

async function fetchOpenMeteoWeather(context: MeteoProviderContext, fetcher: typeof fetch, endpoint: string) {
  const url = new URL(endpoint);
  url.searchParams.set("latitude", String(context.latitude));
  url.searchParams.set("longitude", String(context.longitude));
  url.searchParams.set("current", [
    "temperature_2m",
    "relative_humidity_2m",
    "precipitation",
    "weather_code",
    "cloud_cover",
    "pressure_msl",
    "surface_pressure",
    "wind_speed_10m",
    "wind_direction_10m",
    "wind_gusts_10m",
  ].join(","));
  url.searchParams.set("wind_speed_unit", "kn");
  url.searchParams.set("timezone", "UTC");

  return fetchOpenMeteoCurrent(url, fetcher);
}

async function fetchOpenMeteoMarine(context: MeteoProviderContext, fetcher: typeof fetch, endpoint: string) {
  const url = new URL(endpoint);
  url.searchParams.set("latitude", String(context.latitude));
  url.searchParams.set("longitude", String(context.longitude));
  url.searchParams.set("current", [
    "wave_height",
    "wave_direction",
    "wave_period",
    "swell_wave_height",
    "swell_wave_direction",
    "swell_wave_period",
  ].join(","));
  url.searchParams.set("timezone", "UTC");

  return fetchOpenMeteoCurrent(url, fetcher);
}

async function fetchOpenMeteoCurrent(url: URL, fetcher: typeof fetch) {
  const response = await fetcher(url);
  if (!response.ok) {
    throw new Error(`Open-Meteo request failed with status ${response.status}.`);
  }

  const body = await response.json() as OpenMeteoResponse;
  const current = normalizeCurrent(body.current);
  const validAt = timestampFrom(current.time) ?? new Date();
  return { current, validAt };
}

function normalizeCurrent(current: OpenMeteoResponse["current"] = {}) {
  return Object.fromEntries(Object.entries(current).map(([key, rawValue]) => [key, numberOrString(rawValue)]));
}

function openMeteoProvenance(context: MeteoProviderContext, sourceUrl: string, validAt: Date): MeteoValueProvenance {
  return {
    provider: "open-meteo",
    providerLabel: "Open-Meteo",
    sourceType: "fallback",
    sourceUrl,
    validAt,
    station: {
      id: "open-meteo-grid-point",
      latitude: context.latitude,
      longitude: context.longitude,
      distanceNm: 0,
    },
    quality: "low",
    qualityReason: { code: "meteo.reason.openMeteoFallbackEstimate" },
  };
}

function openMeteoSource(context: MeteoProviderContext, sourceUrl: string, validAt: Date): MeteoSource {
  return {
    provider: "open-meteo",
    providerLabel: "Open-Meteo",
    sourceType: "fallback",
    sourceUrl,
    id: "open-meteo-grid-point",
    latitude: context.latitude,
    longitude: context.longitude,
    validAt,
    distanceNm: 0,
    quality: "low",
    qualityReason: { code: "meteo.reason.openMeteoFallbackEstimate" },
  };
}

function value<TValue, TUnit extends "%" | "c" | "deg" | "hPa" | "kn" | "m" | "mm" | "s" | "text">(
  input: TValue | undefined,
  unit: TUnit,
  provenance: MeteoValueProvenance,
) {
  if (input === undefined) return undefined;
  return { value: input, unit, provenance };
}

function numberOrString(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : value;
  }
  return undefined;
}

function timestampFrom(value: unknown) {
  if (typeof value !== "string") return undefined;
  return new Date(value.endsWith("Z") ? value : `${value}Z`);
}

function weatherCodeDescription(code: unknown) {
  if (typeof code !== "number") return undefined;
  const descriptions: Record<number, string> = {
    0: "clear sky",
    1: "mainly clear",
    2: "partly cloudy",
    3: "overcast",
    45: "fog",
    48: "depositing rime fog",
    51: "light drizzle",
    53: "moderate drizzle",
    55: "dense drizzle",
    61: "slight rain",
    63: "moderate rain",
    65: "heavy rain",
    71: "slight snow",
    73: "moderate snow",
    75: "heavy snow",
    80: "slight rain showers",
    81: "moderate rain showers",
    82: "violent rain showers",
    95: "thunderstorm",
  };
  return descriptions[code] ?? `weather code ${code}`;
}

function numberField(value: unknown) {
  return typeof value === "number" ? value : undefined;
}

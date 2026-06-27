export type GeographicPosition = {
  latitude: number;
  longitude: number;
};

export type NoaaMagneticVariationRequest = GeographicPosition & {
  date?: Date;
  model?: "WMM" | "IGRF" | "EMM" | "WMMHR";
  apiKey?: string;
  fetcher?: typeof fetch;
};

type NoaaDeclinationResult = {
  declination?: number | string;
};

type NoaaDeclinationResponse = {
  result?: NoaaDeclinationResult[];
  declination?: number | string;
};

const noaaDeclinationEndpoint = "https://www.ngdc.noaa.gov/geomag-web/calculators/calculateDeclination";

function assertCoordinate(name: string, value: number, min: number, max: number) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${name} must be a finite number between ${min} and ${max}.`);
  }
}

function readDeclination(response: NoaaDeclinationResponse) {
  const rawDeclination = response.result?.[0]?.declination ?? response.declination;
  const declination = typeof rawDeclination === "string" ? Number(rawDeclination) : rawDeclination;

  if (!Number.isFinite(declination)) {
    throw new Error("NOAA magnetic declination response did not include a numeric declination.");
  }

  return declination;
}

export async function lookupNoaaMagneticVariation({
  latitude,
  longitude,
  date = new Date(),
  model = "WMM",
  apiKey,
  fetcher = fetch,
}: NoaaMagneticVariationRequest) {
  assertCoordinate("latitude", latitude, -90, 90);
  assertCoordinate("longitude", longitude, -180, 180);

  const url = new URL(noaaDeclinationEndpoint);
  url.searchParams.set("lat1", String(latitude));
  url.searchParams.set("lon1", String(longitude));
  url.searchParams.set("model", model);
  url.searchParams.set("resultFormat", "json");
  url.searchParams.set("startYear", String(date.getUTCFullYear()));
  url.searchParams.set("startMonth", String(date.getUTCMonth() + 1));
  url.searchParams.set("startDay", String(date.getUTCDate()));

  if (apiKey) {
    url.searchParams.set("key", apiKey);
  }

  const response = await fetcher(url);
  if (!response.ok) {
    throw new Error(`NOAA magnetic declination request failed with status ${response.status}.`);
  }

  return readDeclination(await response.json() as NoaaDeclinationResponse);
}

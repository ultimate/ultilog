import type { MeteoSnapshot, MeteoValue, MeteoValueProvenance } from "./types";

export type MeteoRemarkFieldKey =
  | "cloudCover"
  | "weatherCondition"
  | "barometer"
  | "temperature"
  | "humidity"
  | "precipitation"
  | "visibility"
  | "windDirection"
  | "windSpeed"
  | "windGusts"
  | "windForce"
  | "waveHeight"
  | "waveDirection"
  | "wavePeriod"
  | "swellHeight"
  | "swellDirection"
  | "swellPeriod"
  | "seaTemperature"
  | "currentSpeed"
  | "currentDirection"
  | "tideHeight"
  | "tidePhase"
  | "moonPhase"
  | "moonIllumination"
  | "sunrise"
  | "sunset"
  | "moonrise"
  | "moonset";

export type MeteoSourceRemarkPart = {
  fields: MeteoRemarkFieldKey[];
  provenance: MeteoValueProvenance;
};

type FieldSource = {
  field: MeteoRemarkFieldKey;
  provenance: MeteoValueProvenance;
};

export function createMeteoSourceRemark(snapshot: MeteoSnapshot) {
  const parts = createMeteoSourceRemarkParts(snapshot);
  if (parts.length === 0) return "No meteo source metadata available.";

  return parts
    .map((group) => `${humanList(group.fields.map(fieldLabel))} from ${describeProvenance(group.provenance)}.`)
    .join(" ");
}

export function createMeteoSourceRemarkParts(snapshot: MeteoSnapshot): MeteoSourceRemarkPart[] {
  return groupFieldSources(collectFieldSources(snapshot));
}

function collectFieldSources(snapshot: MeteoSnapshot): FieldSource[] {
  return [
    ...fieldsFromSection("weather", snapshot.weather, {
      cloudCoverPercent: "cloudCover",
      condition: "weatherCondition",
      pressureHpa: "barometer",
      temperatureC: "temperature",
      humidityPercent: "humidity",
      precipitationMm: "precipitation",
      visibilityM: "visibility",
    }),
    ...fieldsFromSection("wind", snapshot.wind, {
      directionDeg: "windDirection",
      speedKnots: "windSpeed",
      gustKnots: "windGusts",
      beaufort: "windForce",
    }),
    ...fieldsFromSection("sea", snapshot.sea, {
      waveHeightM: "waveHeight",
      waveDirectionDeg: "waveDirection",
      wavePeriodS: "wavePeriod",
      swellHeightM: "swellHeight",
      swellDirectionDeg: "swellDirection",
      swellPeriodS: "swellPeriod",
      seaSurfaceTemperatureC: "seaTemperature",
      currentSpeedKnots: "currentSpeed",
      currentDirectionDeg: "currentDirection",
    }),
    ...fieldsFromSection("tide", snapshot.tide, {
      heightM: "tideHeight",
      phase: "tidePhase",
    }),
    ...fieldsFromSection("astronomy", snapshot.astronomy, {
      moonPhase: "moonPhase",
      moonIlluminationPercent: "moonIllumination",
      sunrise: "sunrise",
      sunset: "sunset",
      moonrise: "moonrise",
      moonset: "moonset",
    }),
  ];
}

function fieldsFromSection(
  _sectionName: string,
  section: Record<string, MeteoValue<unknown> | undefined> | undefined,
  labels: Record<string, MeteoRemarkFieldKey>,
): FieldSource[] {
  if (!section) return [];

  return Object.entries(labels).flatMap(([fieldName, label]) => {
    const value = section[fieldName];
    if (!value) return [];
    return [{ field: label, provenance: value.provenance }];
  });
}

function groupFieldSources(fieldSources: FieldSource[]) {
  const groups = new Map<string, MeteoSourceRemarkPart>();

  for (const fieldSource of fieldSources) {
    const key = provenanceKey(fieldSource.provenance);
    const group = groups.get(key);
    if (group) {
      group.fields.push(fieldSource.field);
    } else {
      groups.set(key, { fields: [fieldSource.field], provenance: fieldSource.provenance });
    }
  }

  return [...groups.values()];
}

function provenanceKey(provenance: MeteoValueProvenance) {
  return JSON.stringify({
    provider: provenance.provider,
    sourceType: provenance.sourceType,
    stationId: provenance.station?.id,
    observedAt: provenance.observedAt?.toISOString(),
    calculatedAt: provenance.calculatedAt?.toISOString(),
    validAt: provenance.validAt?.toISOString(),
  });
}

function describeProvenance(provenance: MeteoValueProvenance) {
  const provider = provenance.providerLabel ?? provenance.provider;
  const station = provenance.station ? ` station ${provenance.station.id}${distanceText(provenance.station.distanceNm)}` : "";
  const time = provenance.observedAt ?? provenance.calculatedAt ?? provenance.validAt;
  const sourceType = provenance.sourceType === "fallback" ? "fallback estimate" : provenance.sourceType;

  return `${provider}${station} (${sourceType}${time ? ` ${formatUtc(time)}` : ""})`;
}

function distanceText(distanceNm: number | undefined) {
  if (distanceNm === undefined) return "";
  return `, ${distanceNm.toFixed(1)} NM away`;
}

function formatUtc(date: Date) {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function humanList(items: string[]) {
  if (items.length <= 2) return items.join(" and ");
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function fieldLabel(field: MeteoRemarkFieldKey) {
  const labels: Record<MeteoRemarkFieldKey, string> = {
    cloudCover: "cloud cover",
    weatherCondition: "weather condition",
    barometer: "barometer",
    temperature: "temperature",
    humidity: "humidity",
    precipitation: "precipitation",
    visibility: "visibility",
    windDirection: "wind direction",
    windSpeed: "wind speed",
    windGusts: "wind gusts",
    windForce: "wind force",
    waveHeight: "wave height",
    waveDirection: "wave direction",
    wavePeriod: "wave period",
    swellHeight: "swell height",
    swellDirection: "swell direction",
    swellPeriod: "swell period",
    seaTemperature: "sea temperature",
    currentSpeed: "current speed",
    currentDirection: "current direction",
    tideHeight: "tide height",
    tidePhase: "tide phase",
    moonPhase: "moon phase",
    moonIllumination: "moon illumination",
    sunrise: "sunrise",
    sunset: "sunset",
    moonrise: "moonrise",
    moonset: "moonset",
  };
  return labels[field];
}

import type { MeteoSnapshot, MeteoValue, MeteoValueProvenance } from "./types";

type FieldSource = {
  field: string;
  provenance: MeteoValueProvenance;
};

export function createMeteoSourceRemark(snapshot: MeteoSnapshot) {
  const fieldSources = collectFieldSources(snapshot);
  if (fieldSources.length === 0) return "No meteo source metadata available.";

  return groupFieldSources(fieldSources)
    .map((group) => `${humanList(group.fields)} from ${describeProvenance(group.provenance)}.`)
    .join(" ");
}

function collectFieldSources(snapshot: MeteoSnapshot): FieldSource[] {
  return [
    ...fieldsFromSection("weather", snapshot.weather, {
      cloudCoverPercent: "cloud cover",
      condition: "weather condition",
      pressureHpa: "barometer",
      temperatureC: "temperature",
      humidityPercent: "humidity",
      precipitationMm: "precipitation",
      visibilityM: "visibility",
    }),
    ...fieldsFromSection("wind", snapshot.wind, {
      directionDeg: "wind direction",
      speedKnots: "wind speed",
      gustKnots: "wind gusts",
      beaufort: "wind force",
    }),
    ...fieldsFromSection("sea", snapshot.sea, {
      waveHeightM: "wave height",
      waveDirectionDeg: "wave direction",
      wavePeriodS: "wave period",
      swellHeightM: "swell height",
      swellDirectionDeg: "swell direction",
      swellPeriodS: "swell period",
      seaSurfaceTemperatureC: "sea temperature",
      currentSpeedKnots: "current speed",
      currentDirectionDeg: "current direction",
    }),
    ...fieldsFromSection("tide", snapshot.tide, {
      heightM: "tide height",
      phase: "tide phase",
    }),
    ...fieldsFromSection("astronomy", snapshot.astronomy, {
      moonPhase: "moon phase",
      moonIlluminationPercent: "moon illumination",
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
  labels: Record<string, string>,
): FieldSource[] {
  if (!section) return [];

  return Object.entries(labels).flatMap(([fieldName, label]) => {
    const value = section[fieldName];
    if (!value) return [];
    return [{ field: label, provenance: value.provenance }];
  });
}

function groupFieldSources(fieldSources: FieldSource[]) {
  const groups = new Map<string, { fields: string[]; provenance: MeteoValueProvenance }>();

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

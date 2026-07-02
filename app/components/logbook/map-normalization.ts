import type { LogLine, LogSheet } from "../../models/logbook";

export type NormalizedMapPoint = {
  id: string;
  label: string;
  time: string;
  position: string;
  latitude: number;
  longitude: number;
  x: number;
  y: number;
};

export type NormalizedMapRoute = {
  points: NormalizedMapPoint[];
  bounds: {
    north: number;
    east: number;
    south: number;
    west: number;
  } | null;
};

export function normalizeLogLinesForMap(lines: LogLine[]): NormalizedMapRoute {
  const coordinates = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => isValidCoordinate(line.latitude, line.longitude));

  if (!coordinates.length) return { points: [], bounds: null };

  const latitudes = coordinates.map(({ line }) => line.latitude);
  const longitudes = coordinates.map(({ line }) => line.longitude);
  const bounds = {
    north: Math.max(...latitudes),
    east: Math.max(...longitudes),
    south: Math.min(...latitudes),
    west: Math.min(...longitudes),
  };
  const latitudeRange = Math.max(bounds.north - bounds.south, 0.000001);
  const longitudeRange = Math.max(bounds.east - bounds.west, 0.000001);

  return {
    bounds,
    points: coordinates.map(({ line, index }) => ({
      id: `${line.time}-${line.position}-${index}`,
      label: String(index + 1),
      time: line.time,
      position: line.position,
      latitude: line.latitude,
      longitude: line.longitude,
      x: ((line.longitude - bounds.west) / longitudeRange) * 100,
      y: (1 - (line.latitude - bounds.south) / latitudeRange) * 100,
    })),
  };
}

export function normalizeLogSheetForMap(sheet: LogSheet): NormalizedMapRoute {
  return normalizeLogLinesForMap(sheet.lines);
}

export function normalizeLogSheetsForMap(sheets: LogSheet[]): NormalizedMapRoute {
  return normalizeLogLinesForMap(sheets.flatMap((sheet) => sheet.lines));
}

function isValidCoordinate(latitude: number, longitude: number) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

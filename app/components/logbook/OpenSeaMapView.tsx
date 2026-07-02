"use client";

import type { CSSProperties } from "react";
import type { LogLine, LogSheet } from "../../models/logbook";

type LatLon = { latitude: number; longitude: number };

type MapMarker = LatLon & {
  id: string;
  label: string;
  title: string;
  description?: string;
};

type MapRoute = {
  id: string;
  label: string;
  points: LatLon[];
  markers?: MapMarker[];
  onClick?: () => void;
};

type OpenSeaMapViewProps = {
  routes: MapRoute[];
  title?: string;
  emptyMessage?: string;
  variant?: "detail" | "overview";
  paddingPercent?: number;
};

type LogLinesMapViewProps = {
  logLines: LogLine[];
  title?: string;
  emptyMessage?: string;
};

type LogSheetsMapViewProps = {
  sheets: LogSheet[];
  title?: string;
  emptyMessage?: string;
  onSheetClick?: (sheet: LogSheet) => void;
};

type ProjectedPoint = LatLon & { x: number; y: number };

type ProjectedRoute = Omit<MapRoute, "points" | "markers"> & {
  points: ProjectedPoint[];
  markers: (MapMarker & ProjectedPoint)[];
};

type Viewport = {
  center: LatLon;
  zoom: number;
  projectedRoutes: ProjectedRoute[];
  tiles: { key: string; url: string; left: number; top: number; size: number; alt: string }[];
};

const TILE_SIZE = 256;
const MIN_ZOOM = 2;
const MAX_ZOOM = 12;
const VIEWPORT_PIXELS = { width: 960, height: 520 };
const OPENSTREETMAP_TILE = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const OPENSEAMAP_TILE = "https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png";

export function OpenSeaMapView({
  routes,
  title = "OpenSeaMap",
  emptyMessage = "No valid positions to show yet.",
  variant = "detail",
  paddingPercent = 12,
}: OpenSeaMapViewProps) {
  const validRoutes = routes
    .map((route) => ({
      ...route,
      points: route.points.filter(isValidCoordinate),
      markers: (route.markers ?? []).filter(isValidCoordinate),
    }))
    .filter((route) => route.points.length || route.markers.length);
  const viewport = buildViewport(validRoutes, paddingPercent);
  const isEmpty = !validRoutes.length;

  return (
    <section className={`open-seamap-view open-seamap-${variant}`} aria-label={title}>
      <h3>{title}</h3>
      {isEmpty || !viewport ? (
        <div className="open-seamap-empty">{emptyMessage}</div>
      ) : (
        <div
          role="img"
          aria-label={`${title} with OpenStreetMap base layer and OpenSeaMap seamark overlay`}
          style={
            {
              "--open-seamap-center-lat": `"${formatCoordinate(viewport.center.latitude, "lat")}"`,
              "--open-seamap-center-lon": `"${formatCoordinate(viewport.center.longitude, "lon")}"`,
            } as CSSProperties
          }
        >
          {viewport.tiles.map((tile) => (
            // eslint-disable-next-line @next/next/no-img-element -- Map tiles are external OpenStreetMap/OpenSeaMap raster tiles, not app assets.
            <img
              alt={tile.alt}
              aria-hidden="true"
              key={tile.key}
              loading="lazy"
              referrerPolicy="no-referrer"
              src={tile.url}
              style={{ left: `${tile.left}%`, top: `${tile.top}%`, width: `${tile.size}%`, height: `${tile.size}%` }}
            />
          ))}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {viewport.projectedRoutes.map((route, routeIndex) => (
              <polyline
                key={route.id}
                points={route.points.map((point) => `${point.x},${point.y}`).join(" ")}
                onClick={route.onClick}
                style={{ cursor: route.onClick ? "pointer" : "default", stroke: routeColor(routeIndex) }}
              />
            ))}
          </svg>
          {viewport.projectedRoutes.flatMap((route) =>
            route.markers.map((marker) => (
              <button
                aria-label={`${marker.title}${marker.description ? `: ${marker.description}` : ""}`}
                key={marker.id}
                onClick={route.onClick}
                title={`${marker.title}${marker.description ? ` · ${marker.description}` : ""}`}
                type="button"
                style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
              >
                <strong>{marker.label}</strong>
                <span>{marker.title}</span>
                {marker.description ? <small>{marker.description}</small> : null}
              </button>
            )),
          )}
        </div>
      )}
    </section>
  );
}

export function LogLinesMapView({
  logLines,
  title = "Log-line positions",
  emptyMessage,
}: LogLinesMapViewProps) {
  const points = logLines.filter((line) => isValidCoordinate(line));

  return (
    <OpenSeaMapView
      emptyMessage={emptyMessage}
      routes={[
        {
          id: "log-lines",
          label: "Log-line route",
          points,
          markers: points.map((line, index) => ({
            id: `${line.time}-${line.position}-${index}`,
            label: String(index + 1),
            title: `${line.time} · ${line.position}`,
            description: [
              `${formatCoordinate(line.latitude, "lat")}, ${formatCoordinate(line.longitude, "lon")}`,
              line.logNm ? `${line.logNm} NM` : "",
              line.course ? `Course ${line.course}` : "",
              line.wind ? `Wind ${line.wind}` : "",
              line.remarks,
            ].filter(Boolean).join(" · "),
            latitude: line.latitude,
            longitude: line.longitude,
          })),
        },
      ]}
      title={title}
      variant="detail"
    />
  );
}

export function LogSheetsMapView({
  sheets,
  title = "Log-sheet routes",
  emptyMessage,
  onSheetClick,
}: LogSheetsMapViewProps) {
  return (
    <OpenSeaMapView
      emptyMessage={emptyMessage}
      routes={sheets.map((sheet) => {
        const points = sheet.lines.filter((line) => isValidCoordinate(line));
        const start = points[0];
        const end = points.at(-1);
        return {
          id: sheet.id,
          label: sheet.title,
          points,
          markers: [start ? sheetMarker(sheet, start, "Start") : null, end && end !== start ? sheetMarker(sheet, end, "End") : null].filter(
            (marker): marker is MapMarker => Boolean(marker),
          ),
          onClick: onSheetClick ? () => onSheetClick(sheet) : undefined,
        };
      })}
      title={title}
      variant="overview"
    />
  );
}

function sheetMarker(sheet: LogSheet, line: LogLine, label: string): MapMarker {
  return {
    id: `${sheet.id}-${label}`,
    label: label[0] ?? "•",
    title: `${label}: ${sheet.title}`,
    description: `${line.time} · ${line.position}`,
    latitude: line.latitude,
    longitude: line.longitude,
  };
}

function buildViewport(routes: MapRoute[], paddingPercent: number): Viewport | null {
  const coordinates = routes.flatMap((route) => [...route.points, ...(route.markers ?? [])]);
  if (!coordinates.length) return null;

  const bounds = coordinates.reduce(
    (current, point) => ({
      north: Math.max(current.north, point.latitude),
      east: Math.max(current.east, point.longitude),
      south: Math.min(current.south, point.latitude),
      west: Math.min(current.west, point.longitude),
    }),
    { north: -90, east: -180, south: 90, west: 180 },
  );
  const zoom = fitZoom(bounds);
  const center = { latitude: (bounds.north + bounds.south) / 2, longitude: (bounds.east + bounds.west) / 2 };
  const centerPixel = latLonToPixel(center, zoom);
  const scaleX = 100 / VIEWPORT_PIXELS.width;
  const scaleY = 100 / VIEWPORT_PIXELS.height;
  const project = <T extends LatLon>(point: T): T & ProjectedPoint => {
    const pixel = latLonToPixel(point, zoom);
    return {
      ...point,
      x: clamp(50 + (pixel.x - centerPixel.x) * scaleX, paddingPercent, 100 - paddingPercent),
      y: clamp(50 + (pixel.y - centerPixel.y) * scaleY, paddingPercent, 100 - paddingPercent),
    };
  };

  return {
    center,
    zoom,
    projectedRoutes: routes.map((route) => ({ ...route, points: route.points.map(project), markers: (route.markers ?? []).map(project) })),
    tiles: buildTiles(centerPixel, zoom),
  };
}

function fitZoom(bounds: { north: number; east: number; south: number; west: number }) {
  for (let zoom = MAX_ZOOM; zoom >= MIN_ZOOM; zoom -= 1) {
    const northWest = latLonToPixel({ latitude: bounds.north, longitude: bounds.west }, zoom);
    const southEast = latLonToPixel({ latitude: bounds.south, longitude: bounds.east }, zoom);
    if (Math.abs(southEast.x - northWest.x) <= VIEWPORT_PIXELS.width * 0.76 && Math.abs(southEast.y - northWest.y) <= VIEWPORT_PIXELS.height * 0.76) {
      return zoom;
    }
  }
  return MIN_ZOOM;
}

function buildTiles(centerPixel: { x: number; y: number }, zoom: number) {
  const left = centerPixel.x - VIEWPORT_PIXELS.width / 2;
  const top = centerPixel.y - VIEWPORT_PIXELS.height / 2;
  const minTileX = Math.floor(left / TILE_SIZE);
  const maxTileX = Math.floor((left + VIEWPORT_PIXELS.width) / TILE_SIZE);
  const minTileY = Math.floor(top / TILE_SIZE);
  const maxTileY = Math.floor((top + VIEWPORT_PIXELS.height) / TILE_SIZE);
  const tileCount = 2 ** zoom;
  const tiles: Viewport["tiles"] = [];

  for (let x = minTileX; x <= maxTileX; x += 1) {
    for (let y = minTileY; y <= maxTileY; y += 1) {
      if (y < 0 || y >= tileCount) continue;
      const wrappedX = ((x % tileCount) + tileCount) % tileCount;
      const leftPercent = ((x * TILE_SIZE - left) / VIEWPORT_PIXELS.width) * 100;
      const topPercent = ((y * TILE_SIZE - top) / VIEWPORT_PIXELS.height) * 100;
      const sizePercent = (TILE_SIZE / VIEWPORT_PIXELS.width) * 100;
      for (const [layer, template] of [["osm", OPENSTREETMAP_TILE], ["seamark", OPENSEAMAP_TILE]] as const) {
        tiles.push({
          key: `${layer}-${zoom}-${wrappedX}-${y}`,
          url: template.replace("{z}", String(zoom)).replace("{x}", String(wrappedX)).replace("{y}", String(y)),
          left: leftPercent,
          top: topPercent,
          size: sizePercent,
          alt: "",
        });
      }
    }
  }
  return tiles;
}

function latLonToPixel(point: LatLon, zoom: number) {
  const sinLatitude = Math.sin((clamp(point.latitude, -85.05112878, 85.05112878) * Math.PI) / 180);
  const worldSize = TILE_SIZE * 2 ** zoom;
  return {
    x: ((point.longitude + 180) / 360) * worldSize,
    y: (0.5 - Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (4 * Math.PI)) * worldSize,
  };
}

function isValidCoordinate(point: LatLon) {
  return Number.isFinite(point.latitude) && Number.isFinite(point.longitude) && point.latitude >= -90 && point.latitude <= 90 && point.longitude >= -180 && point.longitude <= 180;
}

function routeColor(index: number) {
  return ["#2563eb", "#f97316", "#15a66a", "#a855f7", "#ef4444"][index % 5];
}

function formatCoordinate(value: number, axis: "lat" | "lon") {
  const direction = axis === "lat" ? (value >= 0 ? "N" : "S") : value >= 0 ? "E" : "W";
  return `${Math.abs(value).toFixed(4)}° ${direction}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

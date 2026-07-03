"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { LogLine, LogSheet } from "../../models/logbook";
import type { MapRoute } from "./OpenSeaMapLeaflet";

type LogLinesMapViewProps = {
  logLines: LogLine[];
  ariaLabel?: string;
  className?: string;
  emptyMessage?: string;
};

type LogSheetsMapViewProps = {
  sheets: LogSheet[];
  ariaLabel?: string;
  className?: string;
  emptyMessage?: string;
  onSheetClick?: (sheet: LogSheet) => void;
  showRouteTargets?: boolean;
};

const OpenSeaMapLeaflet = dynamic(
  () => import("./OpenSeaMapLeaflet").then((module) => module.OpenSeaMapLeaflet),
  {
    ssr: false,
    loading: () => (
      <div className="open-seamap-empty" role="status">
        Loading map…
      </div>
    ),
  },
);

function isValidCoordinate(line: LogLine) {
  return (
    Number.isFinite(line.latitude) &&
    Number.isFinite(line.longitude) &&
    Math.abs(line.latitude) <= 90 &&
    Math.abs(line.longitude) <= 180
  );
}

function lineDescription(line: LogLine) {
  const details = [
    line.position,
    line.remarks,
    line.weather ? `Weather: ${line.weather}` : undefined,
    line.wind ? `Wind: ${line.wind}` : undefined,
  ].filter(Boolean);

  return details.join(" · ");
}

function lineToPoint(line: LogLine, index: number, routeId: string) {
  return {
    id: `${routeId}-${line.time || "line"}-${index}`,
    latitude: line.latitude,
    longitude: line.longitude,
    label: `${index + 1}`,
    title: line.time ? `${line.time} · ${line.position}` : line.position,
    description: lineDescription(line),
  };
}

function logLinesToRoute(logLines: LogLine[]): MapRoute {
  const points = logLines
    .filter(isValidCoordinate)
    .map((line, index) => lineToPoint(line, index, "log-lines"));

  return {
    id: "log-lines",
    title: "Log line positions",
    points,
    detailLevel: "full",
  };
}

function logSheetToRoute(sheet: LogSheet): MapRoute {
  const points = sheet.lines
    .filter(isValidCoordinate)
    .map((line, index) => lineToPoint(line, index, sheet.id));

  return {
    id: sheet.id,
    title: sheet.title,
    subtitle: `${sheet.dateRange} · ${sheet.route.from} → ${sheet.route.to}`,
    points,
    detailLevel: "summary",
    sheet,
  };
}

export function LogLinesMapView({
  logLines,
  ariaLabel = "Route positions from log lines",
  className = "open-seamap-detail",
  emptyMessage = "No valid positions are recorded for this sheet yet.",
}: LogLinesMapViewProps) {
  const routes = useMemo(() => [logLinesToRoute(logLines)], [logLines]);
  return (
    <OpenSeaMapLeaflet
      ariaLabel={ariaLabel}
      className={className}
      emptyMessage={emptyMessage}
      routes={routes}
    />
  );
}

export function LogSheetsMapView({
  sheets,
  ariaLabel = "Overview map of all log sheets",
  className = "open-seamap-overview",
  emptyMessage = "No valid log sheet positions are available yet.",
  onSheetClick,
  showRouteTargets = true,
}: LogSheetsMapViewProps) {
  const routes = useMemo(() => sheets.map(logSheetToRoute), [sheets]);
  const mappedRoutes = routes.filter(
    (route) => route.sheet && route.points.length > 0,
  );

  return (
    <>
      <OpenSeaMapLeaflet
        ariaLabel={ariaLabel}
        className={className}
        emptyMessage={emptyMessage}
        routes={routes}
        onRouteClick={(route) => {
          if (route.sheet) onSheetClick?.(route.sheet);
        }}
      />
      {showRouteTargets && onSheetClick && mappedRoutes.length > 0 && (
        <nav
          className="open-seamap-route-targets"
          aria-label="Open a log sheet from the overview map"
        >
          <p className="open-seamap-route-targets-title">Map routes</p>
          <ul>
            {mappedRoutes.map((route) => (
              <li key={route.id}>
                <button
                  type="button"
                  aria-label={`Open route ${route.title}`}
                  onClick={() => {
                    if (route.sheet) onSheetClick(route.sheet);
                  }}
                >
                  <span>{route.title}</span>
                  {route.subtitle && <small>{route.subtitle}</small>}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </>
  );
}

"use client";

import { translatedWindDirection } from "./wind-directions";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { useI18n } from "../../lib/i18n";
import { useDateTimeFormat } from "../../lib/DateTimeFormatProvider";
import type { LogLine, LogSheet } from "../../models/logbook";
import type { MapRoute } from "./OpenSeaMapLeaflet";

type LogLinesMapViewProps = {
  logLines: LogLine[];
  ariaLabel?: string;
  className?: string;
  emptyMessage?: string;
  onAddLogLineAt?: (coordinate: { latitude: number; longitude: number }, time?: string) => void;
};

type LogSheetsMapViewProps = {
  sheets: LogSheet[];
  ariaLabel?: string;
  className?: string;
  emptyMessage?: string;
  onSheetClick?: (sheet: LogSheet) => void;
  showRouteTargets?: boolean;
  showEndpointMarkers?: boolean;
  highlightedRouteId?: string | null;
};

function OpenSeaMapLoading() {
  const { t } = useI18n();
  return (
    <div className="open-seamap-empty" role="status">
      {t("map.loading")}
    </div>
  );
}

const OpenSeaMapLeaflet = dynamic(
  () => import("./OpenSeaMapLeaflet").then((module) => module.OpenSeaMapLeaflet),
  {
    ssr: false,
    loading: OpenSeaMapLoading,
  },
);

function isValidCoordinate(line: LogLine): line is LogLine & { latitude: number; longitude: number } {
  return (
    line.latitude !== null && line.longitude !== null && Number.isFinite(line.latitude) &&
    Number.isFinite(line.longitude) &&
    Math.abs(line.latitude) <= 90 &&
    Math.abs(line.longitude) <= 180
  );
}

function lineDescription(line: LogLine, labels: { weather: string; wind: string; direction: (value: string) => string | undefined }) {
  const details = [
    line.remarks,
    line.weather ? `${labels.weather}: ${line.weather}` : undefined,
    line.windDirection || line.windStrength ? `${labels.wind}: ${[labels.direction(line.windDirection), line.windStrength, line.windUnit].filter(Boolean).join(" ")}` : undefined,
  ].filter(Boolean);

  return details.join(" · ");
}

function lineToPoint(line: LogLine & { latitude: number; longitude: number }, index: number, routeId: string, labels: { weather: string; wind: string; direction: (value: string) => string | undefined }, formatTime: (value?: string | null) => string) {
  return {
    id: `${routeId}-${line.time || "line"}-${index}`,
    latitude: line.latitude,
    longitude: line.longitude,
    label: `${index + 1}`,
    title: line.time ? formatTime(line.time) : `${line.latitude}, ${line.longitude}`,
    description: lineDescription(line, labels),
    courseOverGround: line.courseOverGround ?? undefined,
    speedKn: line.speedKn ?? undefined,
  };
}

function logLinesToRoute(logLines: LogLine[], labels: { weather: string; wind: string; logLinePositions: string; direction: (value: string) => string | undefined }, formatTime: (value?: string | null) => string): MapRoute {
  const points = logLines
    .map((line, index) => ({ line, index }))
    .filter((entry): entry is typeof entry & { line: LogLine & { latitude: number; longitude: number } } => isValidCoordinate(entry.line))
    .map(({ line, index }) => lineToPoint(line, index, "log-lines", labels, formatTime));

  return {
    id: "log-lines",
    title: labels.logLinePositions,
    points,
    detailLevel: "full",
  };
}

function logSheetToRoute(sheet: LogSheet, labels: { weather: string; wind: string; direction: (value: string) => string | undefined }, formatDateRange: (from?: string | null, to?: string | null) => string, formatTime: (value?: string | null) => string): MapRoute {
  const points = sheet.lines
    .map((line, index) => ({ line, index }))
    .filter((entry): entry is typeof entry & { line: LogLine & { latitude: number; longitude: number } } => isValidCoordinate(entry.line))
    .map(({ line, index }) => lineToPoint(line, index, sheet.id, labels, formatTime));

  return {
    id: sheet.id,
    title: sheet.title,
    subtitle: `${formatDateRange(sheet.route.departed, sheet.route.arrived)} · ${sheet.route.from} → ${sheet.route.to}`,
    points,
    detailLevel: "summary",
    sheet,
  };
}

export function LogLinesMapView({
  logLines,
  ariaLabel,
  className = "open-seamap-detail",
  emptyMessage,
  onAddLogLineAt,
}: LogLinesMapViewProps) {
  const { t } = useI18n();
  const { formatTime } = useDateTimeFormat();
  const mapLabels = useMemo(() => ({ weather: t("details.weather"), wind: t("details.wind"), direction: (value: string) => translatedWindDirection(value, t), logLinePositions: t("map.logLinePositions") }), [t]);
  const routes = useMemo(() => [logLinesToRoute(logLines, mapLabels, formatTime)], [formatTime, logLines, mapLabels]);
  return (
    <OpenSeaMapLeaflet
      ariaLabel={ariaLabel ?? t("map.routePositionsAria")}
      className={className}
      emptyMessage={emptyMessage ?? t("map.noSheetPositions")}
      routes={routes}
      onAddLogLineAt={onAddLogLineAt}
    />
  );
}

export function LogSheetsMapView({
  sheets,
  ariaLabel,
  className = "open-seamap-overview",
  emptyMessage,
  onSheetClick,
  showRouteTargets = true,
  showEndpointMarkers = true,
  highlightedRouteId,
}: LogSheetsMapViewProps) {
  const { t } = useI18n();
  const { formatDateRange, formatTime } = useDateTimeFormat();
  const mapLabels = useMemo(() => ({ weather: t("details.weather"), wind: t("details.wind"), direction: (value: string) => translatedWindDirection(value, t) }), [t]);
  const routes = useMemo(() => sheets.map((sheet) => logSheetToRoute(sheet, mapLabels, formatDateRange, formatTime)), [formatDateRange, formatTime, mapLabels, sheets]);
  const mappedRoutes = routes.filter(
    (route) => route.sheet && route.points.length > 0,
  );

  return (
    <>
      <OpenSeaMapLeaflet
        ariaLabel={ariaLabel ?? t("logbooks.mapAria")}
        className={className}
        emptyMessage={emptyMessage ?? t("map.noLogSheetPositions")}
        routes={routes}
        showEndpointMarkers={showEndpointMarkers}
        highlightedRouteId={highlightedRouteId}
        onRouteClick={(route) => {
          if (route.sheet) onSheetClick?.(route.sheet);
        }}
      />
      {showRouteTargets && onSheetClick && mappedRoutes.length > 0 && (
        <nav
          className="open-seamap-route-targets"
          aria-label={t("map.openSheetFromOverview")}
        >
          <p className="open-seamap-route-targets-title">{t("map.routes")}</p>
          <ul>
            {mappedRoutes.map((route) => (
              <li key={route.id}>
                <button
                  type="button"
                  aria-label={`${t("map.openRoute")} ${route.title}`}
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

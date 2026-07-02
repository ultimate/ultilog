"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import { LatLngBounds, type LatLngExpression, type PathOptions } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { LogLine, LogSheet } from "../../models/logbook";

type Coordinate = {
  latitude: number;
  longitude: number;
};

type MapMarker = Coordinate & {
  id: string;
  label: string;
  popup: ReactNode;
  tooltip?: string;
};

type MapRoute = {
  id: string;
  label: string;
  points: Coordinate[];
  markers: MapMarker[];
  onClick?: () => void;
};

type OpenSeaMapRendererProps = {
  routes: MapRoute[];
  title: string;
  emptyMessage: string;
  variant: "detail" | "overview";
};

type LogLinesMapViewProps = {
  logLines: LogLine[];
};

type LogSheetsMapViewProps = {
  sheets: LogSheet[];
  onSheetClick?: (sheet: LogSheet) => void;
};

const DEFAULT_CENTER: LatLngExpression = [54.5, 10];
const DEFAULT_ZOOM = 6;
const SINGLE_POINT_ZOOM = 12;
const BOUNDS_PADDING: [number, number] = [36, 36];
const OSM_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const OPENSEAMAP_TILE_URL = "https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png";
const ROUTE_COLORS = ["#2563eb", "#f97316", "#15a66a", "#a855f7", "#ef4444", "#0891b2"];

function OpenSeaMapRenderer({ routes, title, emptyMessage, variant }: OpenSeaMapRendererProps) {
  const validRoutes = useMemo(
    () =>
      routes
        .map((route) => ({
          ...route,
          points: route.points.filter(isValidCoordinate),
          markers: route.markers.filter(isValidCoordinate),
        }))
        .filter((route) => route.points.length > 0 || route.markers.length > 0),
    [routes],
  );
  const coordinates = useMemo(() => validRoutes.flatMap((route) => [...route.points, ...route.markers]), [validRoutes]);

  return (
    <section className={`open-seamap-view open-seamap-${variant}`} aria-label={title}>
      {coordinates.length === 0 ? (
        <div className="open-seamap-empty">{emptyMessage}</div>
      ) : (
        <MapContainer center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} scrollWheelZoom className="open-seamap-map">
          <FitMapToCoordinates coordinates={coordinates} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url={OSM_TILE_URL}
          />
          <TileLayer attribution='Seamarks &copy; <a href="https://www.openseamap.org/">OpenSeaMap</a> contributors' url={OPENSEAMAP_TILE_URL} />
          {validRoutes.map((route, routeIndex) => {
            const color = ROUTE_COLORS[routeIndex % ROUTE_COLORS.length];
            const pathOptions: PathOptions = { color, weight: variant === "detail" ? 4 : 3, opacity: 0.9 };
            return (
              <Polyline
                eventHandlers={route.onClick ? { click: route.onClick } : undefined}
                key={route.id}
                pathOptions={pathOptions}
                positions={route.points.map(toLatLng)}
              >
                <Tooltip sticky>{route.label}</Tooltip>
              </Polyline>
            );
          })}
          {validRoutes.flatMap((route, routeIndex) => {
            const color = ROUTE_COLORS[routeIndex % ROUTE_COLORS.length];
            return route.markers.map((marker) => (
              <CircleMarker
                center={toLatLng(marker)}
                eventHandlers={route.onClick ? { click: route.onClick } : undefined}
                key={marker.id}
                pathOptions={{ color: "#ffffff", fillColor: color, fillOpacity: 1, weight: 2 }}
                radius={variant === "detail" ? 8 : 7}
              >
                {marker.tooltip ? <Tooltip>{marker.tooltip}</Tooltip> : null}
                <Popup>{marker.popup}</Popup>
              </CircleMarker>
            ));
          })}
        </MapContainer>
      )}
    </section>
  );
}

export function LogLinesMapView({ logLines }: LogLinesMapViewProps) {
  const points = logLines.filter(isValidCoordinate);

  return (
    <OpenSeaMapRenderer
      emptyMessage="No valid log-line positions to show yet."
      routes={[
        {
          id: "log-lines",
          label: "Log-line route",
          points,
          markers: points.map((line, index) => ({
            id: `log-line-${line.time}-${index}`,
            label: String(index + 1),
            latitude: line.latitude,
            longitude: line.longitude,
            tooltip: `${line.time} · ${line.position}`,
            popup: <LogLinePopup line={line} index={index} />,
          })),
        },
      ]}
      title="Log-line positions"
      variant="detail"
    />
  );
}

export function LogSheetsMapView({ sheets, onSheetClick }: LogSheetsMapViewProps) {
  return (
    <OpenSeaMapRenderer
      emptyMessage="No valid log-sheet routes to show yet."
      routes={sheets.map((sheet) => {
        const points = sheet.lines.filter(isValidCoordinate);
        const start = points[0];
        const end = points.at(-1);
        return {
          id: sheet.id,
          label: sheet.title,
          points,
          markers: [start ? sheetEndpointMarker(sheet, start, "Start") : null, end && end !== start ? sheetEndpointMarker(sheet, end, "End") : null].filter(
            (marker): marker is MapMarker => Boolean(marker),
          ),
          onClick: onSheetClick ? () => onSheetClick(sheet) : undefined,
        };
      })}
      title="Log-sheet routes"
      variant="overview"
    />
  );
}

function FitMapToCoordinates({ coordinates }: { coordinates: Coordinate[] }) {
  const map = useMap();

  useEffect(() => {
    const validCoordinates = coordinates.filter(isValidCoordinate);
    if (validCoordinates.length === 0) return;
    if (validCoordinates.length === 1) {
      map.setView(toLatLng(validCoordinates[0]), SINGLE_POINT_ZOOM);
      return;
    }
    map.fitBounds(new LatLngBounds(validCoordinates.map(toLatLng)), { padding: BOUNDS_PADDING });
  }, [coordinates, map]);

  return null;
}

function LogLinePopup({ line, index }: { line: LogLine; index: number }) {
  return (
    <div className="open-seamap-popup">
      <strong>Log line {index + 1}</strong>
      <span>Time: {line.time || "—"}</span>
      <span>Position: {line.position || "—"}</span>
      <span>Coordinates: {formatCoordinates(line)}</span>
      <span>Remarks: {line.remarks || "—"}</span>
    </div>
  );
}

function sheetEndpointMarker(sheet: LogSheet, line: LogLine, label: "Start" | "End"): MapMarker {
  return {
    id: `${sheet.id}-${label}`,
    label,
    latitude: line.latitude,
    longitude: line.longitude,
    tooltip: `${label}: ${sheet.title}`,
    popup: (
      <div className="open-seamap-popup">
        <strong>{label}: {sheet.title}</strong>
        <span>{line.time || "—"} · {line.position || "—"}</span>
        <span>{formatCoordinates(line)}</span>
      </div>
    ),
  };
}

function toLatLng(point: Coordinate): LatLngExpression {
  return [point.latitude, point.longitude];
}

function isValidCoordinate(point: Coordinate) {
  return Number.isFinite(point.latitude) && Number.isFinite(point.longitude) && point.latitude >= -90 && point.latitude <= 90 && point.longitude >= -180 && point.longitude <= 180;
}

function formatCoordinates(point: Coordinate) {
  return `${formatCoordinate(point.latitude, "lat")}, ${formatCoordinate(point.longitude, "lon")}`;
}

function formatCoordinate(value: number, axis: "lat" | "lon") {
  const direction = axis === "lat" ? (value >= 0 ? "N" : "S") : value >= 0 ? "E" : "W";
  return `${Math.abs(value).toFixed(4)}° ${direction}`;
}

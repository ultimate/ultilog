"use client";

import { useEffect, useMemo, useState } from "react";
import L, { type LatLngBoundsExpression, type LatLngExpression } from "leaflet";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { useI18n } from "../../lib/i18n";
import type { LogLine, LogSheet } from "../../models/logbook";

type Coordinate = {
  latitude: number;
  longitude: number;
};

type MapPoint = Coordinate & {
  id: string;
  label: string;
  title: string;
  description?: string;
  logLine?: LogLine;
};

export type MapRoute = {
  id: string;
  title: string;
  subtitle?: string;
  points: MapPoint[];
  detailLevel: "full" | "summary";
  sheet?: LogSheet;
};

type OpenSeaMapLeafletProps = {
  routes: MapRoute[];
  ariaLabel?: string;
  className?: string;
  emptyMessage?: string;
  onRouteClick?: (route: MapRoute) => void;
  onAddLogLineAt?: (coordinate: Coordinate) => void;
};

const defaultCenter: LatLngExpression = [54.5, 10.25];
const detailRouteOptions = { color: "#2563eb", weight: 4, opacity: 0.82 };
const summaryRouteOptions = { weight: 5, opacity: 0.76 };
const summaryRoutePalette = [
  "#0f6b8f", // deep harbor blue
  "#d97706", // buoy amber
  "#047857", // sea green
  "#7c3aed", // chart violet
  "#be123c", // signal rose
  "#0891b2", // lagoon cyan
] as const;

function summaryRouteColor(route: MapRoute, routeIndex: number) {
  if (route.id) {
    const hash = Array.from(route.id).reduce(
      (total, character) => total + character.charCodeAt(0),
      0,
    );
    return summaryRoutePalette[hash % summaryRoutePalette.length];
  }

  return summaryRoutePalette[routeIndex % summaryRoutePalette.length];
}

function toLatLng(point: Coordinate): LatLngExpression {
  return [point.latitude, point.longitude];
}

function makeMarkerIcon(label: string, variant: "detail" | "start" | "end") {
  return L.divIcon({
    className: `open-seamap-marker open-seamap-marker-${variant}`,
    html: `<span>${label}</span>`,
    iconAnchor: [15, 15],
    iconSize: [30, 30],
    popupAnchor: [0, -16],
  });
}

function FitMapToRoutes({ routes }: { routes: MapRoute[] }) {
  const map = useMap();
  const points = useMemo(
    () => routes.flatMap((route) => route.points),
    [routes],
  );

  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(toLatLng(points[0]), 11, { animate: false });
      return;
    }

    const bounds = points.map(toLatLng) as LatLngBoundsExpression;
    map.fitBounds(bounds, {
      animate: false,
      paddingTopLeft: [56, 56],
      paddingBottomRight: [56, 56],
      maxZoom: 13,
    });
  }, [map, points]);

  return null;
}

type MapContextMenuState = Coordinate & {
  x: number;
  y: number;
};

function MapContextMenu({
  onAddLogLineAt,
}: {
  onAddLogLineAt?: (coordinate: Coordinate) => void;
}) {
  const { t } = useI18n();
  const [menu, setMenu] = useState<MapContextMenuState | null>(null);

  useMapEvents({
    click: () => setMenu(null),
    contextmenu: (event) => {
      if (!onAddLogLineAt) return;
      setMenu({
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
        x: event.containerPoint.x,
        y: event.containerPoint.y,
      });
    },
    movestart: () => setMenu(null),
    zoomstart: () => setMenu(null),
  });

  if (!menu) return null;

  return (
    <div
      className="open-seamap-context-menu"
      style={{ left: menu.x, top: menu.y }}
      role="menu"
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        role="menuitem"
        onClick={(event) => {
          event.stopPropagation();
          onAddLogLineAt?.({ latitude: menu.latitude, longitude: menu.longitude });
          setMenu(null);
        }}
      >
        {t("map.addLogLineHere")}
      </button>
    </div>
  );
}

function markerPointsForRoute(route: MapRoute) {
  if (route.detailLevel === "full") return route.points;
  if (route.points.length <= 1) return route.points;

  return [
    { ...route.points[0], label: "S", title: `Start · ${route.title}` },
    {
      ...route.points[route.points.length - 1],
      label: "E",
      title: `End · ${route.title}`,
    },
  ];
}

function markerVariant(route: MapRoute, point: MapPoint, markerIndex: number) {
  if (route.detailLevel === "full") return "detail";
  if (route.points.length <= 1) return "detail";
  return markerIndex === 0 ? "start" : "end";
}

export function OpenSeaMapLeaflet({
  routes,
  ariaLabel,
  className,
  emptyMessage,
  onRouteClick,
  onAddLogLineAt,
}: OpenSeaMapLeafletProps) {
  const { t } = useI18n();
  const mapAriaLabel = ariaLabel ?? t("map.routeMapAria");
  const mapEmptyMessage = emptyMessage ?? t("map.noPositions");
  const visibleRoutes = routes.filter((route) => route.points.length > 0);
  const allPoints = visibleRoutes.flatMap((route) => route.points);
  const mapClassName = ["open-seamap-view", className]
    .filter(Boolean)
    .join(" ");

  if (allPoints.length === 0) {
    return (
      <div className="open-seamap-empty" role="status" aria-label={mapAriaLabel}>
        {mapEmptyMessage}
      </div>
    );
  }

  return (
    <div className={mapClassName} aria-label={mapAriaLabel}>
      <MapContainer
        center={defaultCenter}
        zoom={6}
        scrollWheelZoom
        className="open-seamap-container"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <TileLayer
          attribution='Map data: &copy; <a href="https://www.openseamap.org">OpenSeaMap</a> contributors'
          url="https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png"
        />
        <FitMapToRoutes routes={visibleRoutes} />
        <MapContextMenu onAddLogLineAt={onAddLogLineAt} />

        {visibleRoutes.map((route, routeIndex) => {
          const positions = route.points.map(toLatLng);
          const isClickable = Boolean(onRouteClick && route.sheet);
          return (
            <Polyline
              key={route.id}
              pathOptions={
                route.detailLevel === "full"
                  ? detailRouteOptions
                  : {
                      ...summaryRouteOptions,
                      color: summaryRouteColor(route, routeIndex),
                      className: isClickable
                        ? "open-seamap-clickable-route"
                        : undefined,
                    }
              }
              positions={positions}
              eventHandlers={
                isClickable
                  ? {
                      click: () => onRouteClick?.(route),
                    }
                  : undefined
              }
            >
              {route.detailLevel === "summary" && (
                <Tooltip sticky>
                  {route.title}
                  {route.subtitle ? ` · ${route.subtitle}` : ""}
                </Tooltip>
              )}
            </Polyline>
          );
        })}

        {visibleRoutes.flatMap((route) =>
          markerPointsForRoute(route).map((point, markerIndex) => {
            const variant = markerVariant(route, point, markerIndex);
            return (
              <Marker
                key={`${route.id}-${point.id}-${markerIndex}`}
                icon={makeMarkerIcon(point.label, variant)}
                position={toLatLng(point)}
              >
                <Popup>
                  <strong>{point.title}</strong>
                  {route.subtitle && <span>{route.subtitle}</span>}
                  {point.description && <span>{point.description}</span>}
                  <small>
                    {point.latitude.toFixed(5)} / {point.longitude.toFixed(5)}
                  </small>
                </Popup>
              </Marker>
            );
          }),
        )}
      </MapContainer>
    </div>
  );
}

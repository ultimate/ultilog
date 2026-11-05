"use client";

import { useEffect, useRef, useState } from "react";
import L, { type LatLngBoundsExpression, type LatLngExpression } from "leaflet";
import { useI18n } from "../../lib/i18n";
import type { LogLine, LogSheet } from "../../models/logbook";
import { markerCourse } from "./map-marker";

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
  courseOverGround?: number;
  speedKn?: number;
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
  showEndpointMarkers?: boolean;
  highlightedRouteId?: string | null;
  ariaLabel?: string;
  className?: string;
  emptyMessage?: string;
  onRouteClick?: (route: MapRoute) => void;
  onAddLogLineAt?: (coordinate: Coordinate, time?: string) => void;
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

function makeMarkerIcon(point: MapPoint, variant: "detail" | "start" | "end", routeColor?: string) {
  const course = variant === "detail" ? markerCourse(point) : null;
  const shape = course === null ? "circle" : "arrow";
  const styles = [
    course === null ? "" : `--marker-course: ${course}deg`,
    routeColor ? `--marker-fill: ${routeColor}; color: white` : "",
  ].filter(Boolean).join("; ");
  const style = styles ? ` style="${styles}"` : "";

  const label = document.createElement("b");
  label.textContent = point.label;
  return L.divIcon({
    className: `open-seamap-marker open-seamap-marker-${variant} open-seamap-marker-${shape}`,
    html: `<span${style}>${label.outerHTML}</span>`,
    iconAnchor: [12, 12],
    iconSize: [24, 24],
    popupAnchor: [0, -13],
  });
}

type MapContextMenuState = Coordinate & {
  x: number;
  y: number;
};

function MapContextMenu({
  onAddLogLineAt,
  menu,
  setMenu,
}: {
  menu: MapContextMenuState | null;
  setMenu: (menu: MapContextMenuState | null) => void;
  onAddLogLineAt?: (coordinate: Coordinate, time?: string) => void;
}) {
  const { t } = useI18n();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuRef.current) return;
    L.DomEvent.disableClickPropagation(menuRef.current);
    L.DomEvent.disableScrollPropagation(menuRef.current);
  }, [menu]);

  if (!menu) return null;

  const addLogLine = (time?: string) => {
    onAddLogLineAt?.({ latitude: menu.latitude, longitude: menu.longitude }, time);
    setMenu(null);
  };

  return (
    <div
      ref={menuRef}
      className="open-seamap-context-menu"
      style={{ left: menu.x, top: menu.y }}
      role="menu"
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
      onMouseDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="open-seamap-context-menu-header">
        <strong>{t("map.contextCoordinates")}</strong>
        <span>{menu.latitude.toFixed(6)} / {menu.longitude.toFixed(6)}</span>
      </div>
      <button
        type="button"
        role="menuitem"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          addLogLine();
        }}
      >
        {t("map.addLogLineHereNow")}
      </button>
      <label className="open-seamap-context-menu-time">
        <span>{t("map.addLogLineAtTime")}</span>
        <input
          type="time"
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => {
            if (!event.target.value) return;
            addLogLine(event.target.value);
          }}
        />
      </label>
    </div>
  );
}

function markerPointsForRoute(route: MapRoute) {
  if (route.detailLevel === "full") return route.points;
  if (route.points.length <= 1) return route.points;

  return [
    { ...route.points[0], label: "▶", title: `Start · ${route.title}` },
    {
      ...route.points[route.points.length - 1],
      label: "🏁",
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
  showEndpointMarkers = true,
  highlightedRouteId,
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
    <RouteMap
      routes={visibleRoutes}
      ariaLabel={mapAriaLabel}
      className={mapClassName}
      onRouteClick={onRouteClick}
      onAddLogLineAt={onAddLogLineAt}
      showEndpointMarkers={showEndpointMarkers}
      highlightedRouteId={highlightedRouteId}
    />
  );
}

function RouteMap({ routes, ariaLabel, className, onRouteClick, onAddLogLineAt, showEndpointMarkers, highlightedRouteId }: OpenSeaMapLeafletProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const routeStateRef = useRef({ routes, onRouteClick });
  const routeLayersRef = useRef<Array<{ route: MapRoute; index: number; polyline: L.Polyline }>>([]);
  const routeData = JSON.stringify(routes.map(({ sheet, ...route }) => ({ ...route, clickable: Boolean(onRouteClick && sheet) })));

  useEffect(() => { routeStateRef.current = { routes, onRouteClick }; }, [routes, onRouteClick]);
  const [menu, setMenu] = useState<MapContextMenuState | null>(null);
  const coordinates = JSON.stringify(routes.flatMap((route) => route.points.map(toLatLng)));

  useEffect(() => {
    if (!containerRef.current) return;
    const map = L.map(containerRef.current, { center: defaultCenter, zoom: 6, scrollWheelZoom: true });
    mapRef.current = map;
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors (ODbL)',
      // Browser caching and Referer headers follow the tile provider's policy.
    }).addTo(map);
    L.tileLayer("https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openseamap.org">OpenSeaMap</a> contributors · <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC BY-SA 2.0</a>',
    }).addTo(map);
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(containerRef.current);
    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const dismiss = () => setMenu(null);
    const open = (event: L.LeafletMouseEvent) => {
      if (!onAddLogLineAt) return;
      setMenu({ latitude: event.latlng.lat, longitude: event.latlng.lng, x: event.containerPoint.x + map.getContainer().offsetLeft, y: event.containerPoint.y + map.getContainer().offsetTop });
    };
    map.on("click movestart zoomstart", dismiss);
    map.on("contextmenu", open);
    return () => {
      map.off("click movestart zoomstart", dismiss);
      map.off("contextmenu", open);
    };
  }, [onAddLogLineAt]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const positions = JSON.parse(coordinates) as LatLngExpression[];
    if (positions.length === 1) map.setView(positions[0], 11, { animate: false });
    else if (positions.length > 1) map.fitBounds(positions as LatLngBoundsExpression, {
      animate: false, paddingTopLeft: [56, 56], paddingBottomRight: [56, 56], maxZoom: 13,
    });
  }, [coordinates]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const layers = L.layerGroup().addTo(map);
    const renderedRoutes = JSON.parse(routeData) as Array<MapRoute & { clickable: boolean }>;
    routeLayersRef.current = [];
    renderedRoutes.forEach((route, routeIndex) => {
      const isClickable = route.clickable;
      const polyline = L.polyline(route.points.map(toLatLng), route.detailLevel === "full" ? detailRouteOptions : {
        ...summaryRouteOptions,
        weight: 5,
        opacity: 0.76,
        color: summaryRouteColor(route, routeIndex),
        className: isClickable ? "open-seamap-clickable-route" : undefined,
      }).addTo(layers);
      routeLayersRef.current.push({ route, index: routeIndex, polyline });
      if (isClickable) polyline.on("click", () => {
        const current = routeStateRef.current;
        const latestRoute = current.routes.find((candidate) => candidate.id === route.id);
        if (latestRoute) current.onRouteClick?.(latestRoute);
      });
      if (route.detailLevel === "summary") {
        const tooltip = document.createElement("span");
        tooltip.textContent = route.title + (route.subtitle ? ` · ${route.subtitle}` : "");
        polyline.bindTooltip(tooltip, { sticky: true });
      }
      if (!showEndpointMarkers && route.detailLevel !== "full") return;
      markerPointsForRoute(route).forEach((point, markerIndex) => {
        const variant = markerVariant(route, point, markerIndex);
        const popup = document.createElement("div");
        for (const [tag, text] of [["strong", point.title], ["span", route.subtitle], ["span", point.description], ["small", `${point.latitude.toFixed(5)} / ${point.longitude.toFixed(5)}`]]) {
          if (!text) continue;
          const element = document.createElement(tag!);
          element.textContent = text;
          popup.append(element);
        }
        const marker = L.marker(toLatLng(point), {
          icon: makeMarkerIcon(point, variant, route.detailLevel === "summary" ? summaryRouteColor(route, routeIndex) : undefined),
          zIndexOffset: variant === "end" ? 1000 : 0,
          // Focus must not move a marker between mouse-down and mouse-up.
          autoPanOnFocus: false,
        }).bindPopup(popup).addTo(layers);
        const icon = marker.getElement();
        if (icon) L.DomEvent.on(icon, "mousedown", (event) => {
          // Browser focus scrolling can move Leaflet's clipped panes before
          // mouse-up. Keep keyboard focus without scrolling the map container.
          event.preventDefault();
          event.stopPropagation();
          icon.focus({ preventScroll: true });
        });
      });
    });
    return () => { layers.remove(); };
  }, [routeData, showEndpointMarkers]);

  useEffect(() => {
    for (const { route, polyline } of routeLayersRef.current) {
      if (route.detailLevel !== "summary") continue;
      polyline.setStyle({
        weight: route.id === highlightedRouteId ? 9 : 5,
        opacity: highlightedRouteId ? (route.id === highlightedRouteId ? 1 : 0.3) : 0.76,
      });
    }
  }, [routeData, showEndpointMarkers, highlightedRouteId]);

  return (
    <div className={className} aria-label={ariaLabel}>
      <div ref={containerRef} className="open-seamap-container" />
      <MapContextMenu menu={menu} setMenu={setMenu} onAddLogLineAt={onAddLogLineAt} />
    </div>
  );
}

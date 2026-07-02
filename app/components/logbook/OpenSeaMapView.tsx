import type { LogLine, LogSheet } from "../../models/logbook";
import {
  normalizeLogLinesForMap,
  normalizeLogSheetForMap,
  normalizeLogSheetsForMap,
  type NormalizedMapRoute,
} from "./map-normalization";

type OpenSeaMapViewProps = {
  route: NormalizedMapRoute;
  title?: string;
  description?: string;
  variant?: "detail" | "overview";
};

type LogLinesMapViewProps = {
  lines: LogLine[];
  title?: string;
  description?: string;
};

type LogSheetsMapViewProps = {
  sheets: LogSheet[];
  title?: string;
  description?: string;
};

export function OpenSeaMapView({
  route,
  title = "OpenSeaMap",
  description = "Positions connected from log lines",
  variant = "detail",
}: OpenSeaMapViewProps) {
  const variantClass =
    variant === "overview" ? "open-seamap-overview" : "open-seamap-detail";

  return (
    <section className={`open-seamap-view ${variantClass}`} aria-label={title}>
      <div className="open-seamap-header">
        <p className="open-seamap-eyebrow">Map</p>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      {route.points.length ? (
        <div className="open-seamap-canvas" role="img" aria-label={description}>
          <svg className="open-seamap-route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <polyline
              className="open-seamap-route-line"
              points={route.points.map((point) => `${point.x},${point.y}`).join(" ")}
            />
          </svg>
          {route.points.map((point) => (
            <span
              className="open-seamap-marker"
              key={point.id}
              style={{ left: `${point.x}%`, top: `${point.y}%` }}
              title={`${point.time} · ${point.position}`}
            >
              {point.label}
            </span>
          ))}
        </div>
      ) : (
        <div className="open-seamap-empty">No valid positions to show yet.</div>
      )}
    </section>
  );
}

export function LogLinesMapView({
  lines,
  title = "OpenSeaMap",
  description = "Positions connected from log lines",
}: LogLinesMapViewProps) {
  return (
    <OpenSeaMapView
      route={normalizeLogLinesForMap(lines)}
      title={title}
      description={description}
      variant="detail"
    />
  );
}

export function LogSheetsMapView({
  sheets,
  title = "OpenSeaMap overview",
  description = "Positions connected across log sheets",
}: LogSheetsMapViewProps) {
  return (
    <OpenSeaMapView
      route={normalizeLogSheetsForMap(sheets)}
      title={title}
      description={description}
      variant="overview"
    />
  );
}

export { normalizeLogSheetForMap };

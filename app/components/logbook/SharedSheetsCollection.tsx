"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { LogSheetsMapView } from "./OpenSeaMapView";
import { embedThemeDefaults, type EmbedTheme } from "../../domain/logbook/embed-theme";
import type { LogSheet } from "../../models/logbook";
import { useDateTimeFormat } from "../../lib/DateTimeFormatProvider";
import { formatMiles } from "../../lib/format-number";
import { formatLogSheetDuration } from "../../domain/logbook/sheet-metrics";

const colors: { key: keyof EmbedTheme; label: string; parameter: string }[] = [
  { key: "background", label: "Page background", parameter: "bg" },
  { key: "surface", label: "Cards", parameter: "surface" },
  { key: "text", label: "Text", parameter: "text" },
  { key: "accent", label: "Accent", parameter: "accent" },
];

type SharedCollectionEntry = { sheet: LogSheet; boatName: string };

export function SharedSheetsCollection({ ownerId, entries, initialView, embedded, showEmbedding, showMapLegend = true }: { ownerId: string; entries: SharedCollectionEntry[]; initialView: "list" | "map"; embedded: boolean; showEmbedding: boolean; showMapLegend?: boolean }) {
  const { formatDate } = useDateTimeFormat();
  const [view, setView] = useState(initialView);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [includeMapLegend, setIncludeMapLegend] = useState(true);
  const [theme, setTheme] = useState<EmbedTheme>({ ...embedThemeDefaults });
  const baseUrl = typeof window === "undefined" ? `/share/${encodeURIComponent(ownerId)}` : `${window.location.origin}/share/${encodeURIComponent(ownerId)}`;
  const filtered = useMemo(() => entries.filter(({ sheet }) => {
    const start = (sheet.route.departed || sheet.route.arrived).slice(0, 10);
    const end = (sheet.route.arrived || sheet.route.departed).slice(0, 10);
    return (!from || !end || end >= from) && (!to || !start || start <= to);
  }).sort((a, b) => {
    const aStart = a.sheet.route.departed;
    const bStart = b.sheet.route.departed;
    if (!aStart) return bStart ? 1 : a.sheet.id.localeCompare(b.sheet.id);
    if (!bStart) return -1;
    return aStart.localeCompare(bStart) || a.sheet.id.localeCompare(b.sheet.id);
  }), [entries, from, to]);
  const href = (sheet: LogSheet) => `/share/${encodeURIComponent(ownerId)}/${encodeURIComponent(sheet.id)}`;
  const embedCode = (mode: "list" | "map") => {
    return `<iframe src="${embedUrl(mode)}" title="Shared Ultilog log sheets (${mode})" width="100%" height="800" style="border:0;border-radius:16px" loading="lazy"></iframe>`;
  };
  const embedUrl = (mode: "list" | "map") => {
    const query = new URLSearchParams({ embed: "1", view: mode });
    colors.forEach(item => query.set(item.parameter, theme[item.key]));
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    if (mode === "map" && !includeMapLegend) query.set("legend", "0");
    return `${baseUrl}?${query}`;
  };

  return <>
    {!embedded && <div className="shared-collection-controls" role="group" aria-label="Shared log sheet view">
      <button className={view === "list" ? "active" : ""} type="button" onClick={() => setView("list")}>List</button>
      <button className={view === "map" ? "active" : ""} type="button" onClick={() => setView("map")}>Map</button>
    </div>}
    {filtered.length === 0 ? <article className="logbook-section shared-empty"><h2>No shared log sheets</h2><p>No log sheets are visible for this date range and your access level.</p></article> : view === "map" ?
      <article className="map-card logbook-section"><LogSheetsMapView sheets={filtered.map(({ sheet }) => sheet)} onSheetClick={sheet => { window.location.href = href(sheet); }} showRouteTargets={showMapLegend} /></article> :
      <article className="table-card logbook-list-card"><div className="table-scroll"><table className="logbook-table"><thead><tr><th>Start date</th><th>End date</th><th>Entry</th><th>Vessel</th><th>From / to</th><th>Sail miles</th><th>Motor miles</th><th>Total miles</th><th>Duration</th><th></th></tr></thead><tbody>{filtered.map(({ sheet, boatName }) => <tr key={sheet.id}><td>{formatDate(sheet.route.departed)}</td><td>{formatDate(sheet.route.arrived)}</td><td><Link className="table-title-button" href={href(sheet)}>{sheet.title}</Link></td><td>{boatName || "Not shared"}</td><td>{[sheet.route.from, sheet.route.to].filter(Boolean).join(" → ") || "Not shared"}</td><td>{sheet.metrics ? `${formatMiles(sheet.metrics.sailMiles)} nm` : "Not shared"}</td><td>{sheet.metrics ? `${formatMiles(sheet.metrics.motorMiles)} nm` : "Not shared"}</td><td>{sheet.metrics ? `${formatMiles(sheet.metrics.totalMiles)} nm` : "Not shared"}</td><td>{sheet.metrics ? formatLogSheetDuration(sheet.metrics.durationMinutes) : "Not shared"}</td><td><Link className="edit-chip" href={href(sheet)}>Open</Link></td></tr>)}</tbody></table></div></article>}
    {showEmbedding && !embedded ? <section className="embed-builder shared-embed-builder" aria-labelledby="collection-embed-title">
      <div><h2 id="collection-embed-title">Embed shared log sheets</h2><p>Choose colors and an optional date range, then copy either the list or map embed code.</p></div>
      <div className="embed-date-grid"><label><span>From</span><input type="date" value={from} onChange={event => setFrom(event.target.value)} /></label><label><span>To</span><input type="date" value={to} onChange={event => setTo(event.target.value)} /></label></div>
      <label className="embed-legend-option"><input type="checkbox" checked={includeMapLegend} onChange={event => setIncludeMapLegend(event.currentTarget.checked)} /><span>Include route legend in map embed</span></label>
      <div className="embed-color-grid">{colors.map(item => <label key={item.key}><span>{item.label}</span><input type="color" value={theme[item.key]} onChange={event => setTheme(current => ({ ...current, [item.key]: event.target.value }))} /></label>)}</div>
      {(["list", "map"] as const).map(mode => <div className="embed-code-block" key={mode}><label className="embed-code-label" htmlFor={`${mode}-embed-code`}>{mode === "list" ? "List" : "Map"} embed code</label><textarea id={`${mode}-embed-code`} value={embedCode(mode)} readOnly rows={4} /><div className="embed-actions"><button type="button" onClick={() => void navigator.clipboard.writeText(embedCode(mode))}>Copy {mode} embed code</button><a href={embedUrl(mode)} target="_blank" rel="noreferrer">Preview {mode} embed</a></div></div>)}
    </section> : null}
  </>;
}

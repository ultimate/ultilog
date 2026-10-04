"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { LogSheetsMapView } from "./OpenSeaMapView";
import { embedThemeDefaults, type EmbedTheme } from "../../domain/logbook/embed-theme";
import type { LogSheet } from "../../models/logbook";

const colors: { key: keyof EmbedTheme; label: string; parameter: string }[] = [
  { key: "background", label: "Page background", parameter: "bg" },
  { key: "surface", label: "Cards", parameter: "surface" },
  { key: "text", label: "Text", parameter: "text" },
  { key: "accent", label: "Accent", parameter: "accent" },
];

export function SharedSheetsCollection({ ownerId, sheets, initialView, embedded, showEmbedding }: { ownerId: string; sheets: LogSheet[]; initialView: "list" | "map"; embedded: boolean; showEmbedding: boolean }) {
  const [view, setView] = useState(initialView);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [theme, setTheme] = useState<EmbedTheme>({ ...embedThemeDefaults });
  const baseUrl = typeof window === "undefined" ? `/share/${encodeURIComponent(ownerId)}` : `${window.location.origin}/share/${encodeURIComponent(ownerId)}`;
  const filtered = useMemo(() => sheets.filter(sheet => {
    const start = (sheet.route.departed || sheet.route.arrived).slice(0, 10);
    const end = (sheet.route.arrived || sheet.route.departed).slice(0, 10);
    return (!from || !end || end >= from) && (!to || !start || start <= to);
  }), [from, sheets, to]);
  const href = (sheet: LogSheet) => `/share/${encodeURIComponent(ownerId)}/${encodeURIComponent(sheet.id)}`;
  const embedCode = (mode: "list" | "map") => {
    const query = new URLSearchParams({ embed: "1", view: mode });
    colors.forEach(item => query.set(item.parameter, theme[item.key]));
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    return `<iframe src="${baseUrl}?${query}" title="Shared Ultilog log sheets (${mode})" width="100%" height="800" style="border:0;border-radius:16px" loading="lazy"></iframe>`;
  };

  return <>
    {!embedded && <div className="shared-collection-controls" role="group" aria-label="Shared log sheet view">
      <button className={view === "list" ? "active" : ""} type="button" onClick={() => setView("list")}>List</button>
      <button className={view === "map" ? "active" : ""} type="button" onClick={() => setView("map")}>Map</button>
    </div>}
    {filtered.length === 0 ? <article className="logbook-section shared-empty"><h2>No shared log sheets</h2><p>No log sheets are visible for this date range and your access level.</p></article> : view === "map" ?
      <article className="map-card logbook-section"><div className="logbook-map-heading"><h2>Shared routes</h2></div><LogSheetsMapView sheets={filtered} onSheetClick={sheet => { window.location.href = href(sheet); }} /></article> :
      <div className="shared-sheet-list">{filtered.map(sheet => <Link className="shared-sheet-card" href={href(sheet)} key={sheet.id}><div><p className="eyebrow">Shared log sheet</p><h2>{sheet.title}</h2></div><dl><div><dt>Route</dt><dd>{[sheet.route.from, sheet.route.to].filter(Boolean).join(" → ") || "Not shared"}</dd></div><div><dt>Date</dt><dd>{[sheet.route.departed, sheet.route.arrived].filter(Boolean).join(" – ") || "Not shared"}</dd></div></dl><span aria-hidden="true">Open →</span></Link>)}</div>}
    {showEmbedding && !embedded ? <section className="embed-builder shared-embed-builder" aria-labelledby="collection-embed-title">
      <div><h2 id="collection-embed-title">Embed shared log sheets</h2><p>Choose colors and an optional date range, then copy either the list or map embed code.</p></div>
      <div className="embed-date-grid"><label><span>From</span><input type="date" value={from} onChange={event => setFrom(event.target.value)} /></label><label><span>To</span><input type="date" value={to} onChange={event => setTo(event.target.value)} /></label></div>
      <div className="embed-color-grid">{colors.map(item => <label key={item.key}><span>{item.label}</span><input type="color" value={theme[item.key]} onChange={event => setTheme(current => ({ ...current, [item.key]: event.target.value }))} /></label>)}</div>
      {(["list", "map"] as const).map(mode => <div className="embed-code-block" key={mode}><label className="embed-code-label" htmlFor={`${mode}-embed-code`}>{mode === "list" ? "List" : "Map"} embed code</label><textarea id={`${mode}-embed-code`} value={embedCode(mode)} readOnly rows={4} /><div className="embed-actions"><button type="button" onClick={() => void navigator.clipboard.writeText(embedCode(mode))}>Copy {mode} embed code</button></div></div>)}
    </section> : null}
  </>;
}

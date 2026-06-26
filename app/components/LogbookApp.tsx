"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { boats as seedBoats, logSheets as seedSheets, type Boat, type BoatForm, type BoatType, type CrewForm, type LineForm, type LogLine, type LogSheet, type PersistedLogbook, type SheetForm } from "../data/logbook";
import { ManagerShell, type SplitDirection } from "./managers/ManagerShell";
import { courseConversionColumns } from "../domain/nautical/course-conversion";
import { type ModuleTab } from "../templates/app-shell";
import { ModuleTabs } from "../templates/ModuleTabs";
import { DashboardPanel } from "../templates/DashboardPanel";
import { legalRequirements } from "../templates/compliance";

const defaultSheetForm = (boatId: string): SheetForm => ({ title: "", dateRange: new Date().toISOString().slice(0, 10), boatId, dayGoal: "", from: "", to: "", morningPosition: "", eveningPosition: "" });
const defaultBoatForm: BoatForm = { name: "", type: "Sail", registration: "", flagState: "", homePort: "", owner: "", dimensions: "", manufacturer: "", mmsi: "", engine: "", safety: "" };
const defaultLineForm: LineForm = { time: "", position: "", latitude: "", longitude: "", logNm: "", course: "", magneticCourse: "", seaState: "", barometer: "", wind: "", weather: "", sails: "", engine: "", remarks: "" };
const defaultCrewForm: CrewForm = { name: "", nationality: "", role: "", embarkation: "", disembarkation: "" };
const defaultLogbook: PersistedLogbook = { boats: seedBoats, sheets: seedSheets };
const boatToForm = (boat: Boat): BoatForm => ({ name: boat.name, type: boat.type, registration: boat.registration, flagState: boat.flagState, homePort: boat.homePort, owner: boat.owner, dimensions: boat.dimensions, manufacturer: boat.yachtData.Manufacturer === "—" ? "" : boat.yachtData.Manufacturer, mmsi: boat.yachtData.MMSI === "—" ? "" : boat.yachtData.MMSI, engine: boat.yachtData.Engine === "—" ? "" : boat.yachtData.Engine, safety: boat.yachtData.Safety === "To be completed" ? "" : boat.yachtData.Safety });
const sheetToForm = (sheet: LogSheet): SheetForm => ({ title: sheet.title, dateRange: sheet.dateRange, boatId: sheet.boatId, dayGoal: sheet.route.dayGoal, from: sheet.route.from, to: sheet.route.to, morningPosition: sheet.route.morningPosition, eveningPosition: sheet.route.eveningPosition });
const lineToForm = (line: LogLine): LineForm => ({ time: line.time, position: line.position, latitude: line.latitude.toString(), longitude: line.longitude.toString(), logNm: line.logNm.toString(), course: line.course, magneticCourse: line.magneticCourse, seaState: line.seaState, barometer: line.barometer, wind: line.wind, weather: line.weather, sails: line.sails, engine: line.engine, remarks: line.remarks });
const crewToForm = (crew: CrewForm): CrewForm => ({ name: crew.name, nationality: crew.nationality, role: crew.role, embarkation: crew.embarkation, disembarkation: crew.disembarkation });

const slug = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || crypto.randomUUID();
const numberOrZero = (value: string) => Number.parseFloat(value) || 0;

function persistLogbook(logbook: PersistedLogbook, options?: { signal?: AbortSignal; keepalive?: boolean }) {
  return fetch("/api/logbook", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(logbook),
    signal: options?.signal,
    keepalive: options?.keepalive,
  });
}

export function LogbookApp({ userEmail }: { userEmail?: string }) {
  const router = useRouter();
  const [logbook, setLogbook] = useState<PersistedLogbook>(defaultLogbook);
  const [activeSheetId, setActiveSheetId] = useState(defaultLogbook.sheets[0].id);
  const [isBackendReady, setIsBackendReady] = useState(false);
  const [activeModule, setActiveModule] = useState<ModuleTab>("dashboard");
  const [boatSplit, setBoatSplit] = useState<SplitDirection>("vertical");
  const [crewSplit, setCrewSplit] = useState<SplitDirection>("vertical");
  const [showCourseColumns, setShowCourseColumns] = useState(false);
  const [showNewSheet, setShowNewSheet] = useState(false);
  const [showBoatManager, setShowBoatManager] = useState(false);
  const [showAddLine, setShowAddLine] = useState(false);
  const [sheetForm, setSheetForm] = useState<SheetForm>(sheetToForm(defaultLogbook.sheets[0]));
  const [boatForm, setBoatForm] = useState<BoatForm>(defaultBoatForm);
  const [lineForm, setLineForm] = useState<LineForm>(defaultLineForm);
  const [crewForm, setCrewForm] = useState<CrewForm>(defaultCrewForm);
  const [editingBoatId, setEditingBoatId] = useState<string | null>(null);
  const [editingSheetId, setEditingSheetId] = useState<string | null>(null);
  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null);
  const [selectedBoatId, setSelectedBoatId] = useState(defaultLogbook.boats[0].id);
  const [selectedCrewIndex, setSelectedCrewIndex] = useState(0);
  const [lastCrewIndex, setLastCrewIndex] = useState(0);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const logbookRef = useRef(logbook);

  useEffect(() => {
    logbookRef.current = logbook;
  }, [logbook]);

  async function logout() {
    setSaveError(null);
    setIsLoggingOut(true);
    persistLogbook(logbookRef.current, { keepalive: true }).catch(() => undefined);
    await signOut({ redirect: false });
    router.push("/login");
    router.refresh();
  }

  async function saveLogbookNow(nextLogbook: PersistedLogbook) {
    logbookRef.current = nextLogbook;
    setLogbook(nextLogbook);
    setSaveError(null);
    if (!isBackendReady) return true;
    const response = await persistLogbook(nextLogbook).catch(() => undefined);
    if (response?.ok) return true;
    setSaveError("Unable to save the latest changes. Please try again.");
    return false;
  }

  useEffect(() => {
    let isMounted = true;
    async function loadLogbook() {
      const response = await fetch("/api/logbook");
      if (!response.ok) throw new Error("Unable to load logbook");
      const storedLogbook = await response.json() as PersistedLogbook;
      if (!isMounted) return;
      logbookRef.current = storedLogbook;
      setLogbook(storedLogbook);
      setActiveSheetId(storedLogbook.sheets[0]?.id ?? defaultLogbook.sheets[0].id);
      setSheetForm((current) => ({ ...current, boatId: storedLogbook.boats[0]?.id ?? seedBoats[0].id }));
      setSelectedBoatId(storedLogbook.boats[0]?.id ?? seedBoats[0].id);
      setIsBackendReady(true);
    }
    loadLogbook().catch(() => setIsBackendReady(true));
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    if (!isBackendReady) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      persistLogbook(logbook, { signal: controller.signal }).catch(() => undefined);
    }, 300);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [isBackendReady, logbook]);

  useEffect(() => {
    if (!isBackendReady) return;
    const saveBeforeLeaving = () => {
      persistLogbook(logbookRef.current, { keepalive: true }).catch(() => undefined);
    };
    const saveWhenHidden = () => {
      if (document.visibilityState === "hidden") saveBeforeLeaving();
    };
    window.addEventListener("pagehide", saveBeforeLeaving);
    document.addEventListener("visibilitychange", saveWhenHidden);
    return () => {
      window.removeEventListener("pagehide", saveBeforeLeaving);
      document.removeEventListener("visibilitychange", saveWhenHidden);
    };
  }, [isBackendReady]);


  const activeSheet = logbook.sheets.find((sheet) => sheet.id === activeSheetId) ?? logbook.sheets[0];
  const activeBoat = logbook.boats.find((boat) => boat.id === activeSheet.boatId) ?? logbook.boats[0];
  const selectedBoat = logbook.boats.find((boat) => boat.id === selectedBoatId) ?? logbook.boats[0];
  const stats = useMemo(() => {
    const totalNm = logbook.sheets.reduce((sum, sheet) => sum + Math.max(0, ...sheet.lines.map((line) => line.logNm)), 0);
    const sailNm = logbook.sheets.filter((sheet) => logbook.boats.find((boat) => boat.id === sheet.boatId)?.type === "Sail").reduce((sum, sheet) => sum + Math.max(0, ...sheet.lines.map((line) => line.logNm)), 0);
    return { totalNm, sailNm, motorNm: totalNm - sailNm, sheets: logbook.sheets.length, boats: logbook.boats.length };
  }, [logbook]);

  async function saveBoat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = editingBoatId ?? `${slug(boatForm.name)}-${Date.now().toString(36)}`;
    const currentLogbook = logbookRef.current;
    const previousBoat = currentLogbook.boats.find((boat) => boat.id === id);
    const boat: Boat = {
      id,
      name: boatForm.name,
      type: boatForm.type,
      registration: boatForm.registration,
      flagState: boatForm.flagState,
      homePort: boatForm.homePort,
      owner: boatForm.owner,
      dimensions: boatForm.dimensions,
      yachtData: {
        "Class / type": boatForm.type === "Sail" ? "Cruising yacht" : "Motor yacht",
        MMSI: boatForm.mmsi || "—",
        Manufacturer: boatForm.manufacturer || "—",
        "Hull length": boatForm.dimensions || "—",
        Beam: previousBoat?.yachtData.Beam ?? "—",
        Draft: previousBoat?.yachtData.Draft ?? "—",
        Displacement: previousBoat?.yachtData.Displacement ?? "—",
        "Rig / sail area": boatForm.type === "Sail" ? "To be completed" : "n/a",
        Engine: boatForm.engine || "—",
        Propeller: previousBoat?.yachtData.Propeller ?? "—",
        Electronics: previousBoat?.yachtData.Electronics ?? "To be completed",
        Safety: boatForm.safety || "To be completed",
      },
    };
    const nextLogbook = { ...currentLogbook, boats: editingBoatId ? currentLogbook.boats.map((candidate) => candidate.id === editingBoatId ? boat : candidate) : [...currentLogbook.boats, boat] };
    if (!await saveLogbookNow(nextLogbook)) return;
    setBoatForm(defaultBoatForm);
    setEditingBoatId(null);
    setShowBoatManager(false);
    setSelectedBoatId(id);
    setSheetForm((current) => ({ ...current, boatId: id }));
  }

  async function saveSheet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const currentLogbook = logbookRef.current;
    const existingSheet = editingSheetId ? currentLogbook.sheets.find((sheet) => sheet.id === editingSheetId) : undefined;
    const base = existingSheet ?? seedSheets[0];
    const id = editingSheetId ?? `${slug(sheetForm.title || sheetForm.dayGoal)}-${Date.now().toString(36)}`;
    const sheet: LogSheet = {
      ...base,
      id,
      title: sheetForm.title || sheetForm.dayGoal || "Untitled sheet",
      dateRange: sheetForm.dateRange,
      status: "Draft",
      boatId: sheetForm.boatId,
      route: {
        dayGoal: sheetForm.dayGoal,
        morningPosition: sheetForm.morningPosition || sheetForm.from,
        eveningPosition: sheetForm.eveningPosition || sheetForm.to,
        from: sheetForm.from,
        to: sheetForm.to,
        departed: `${sheetForm.dateRange}, departure open`,
        arrived: `${sheetForm.dateRange}, arrival open`,
      },
      weatherBriefing: { station: "", time: "", area: "", forecast: "", warnings: "" },
      daySummary: { area: "", nightHours: 0, daysOnBoard: 1, sailingMiles: 0, motorMiles: 0, outsideFb2Miles: 0, engineHoursStart: 0, engineHoursEnd: 0 },
      remarks: [],
      crew: [],
      watchPlan: [],
      technicalChecks: [],
      lines: [],
    };
    const nextLogbook = { ...currentLogbook, sheets: editingSheetId ? currentLogbook.sheets.map((candidate) => candidate.id === editingSheetId ? sheet : candidate) : [sheet, ...currentLogbook.sheets] };
    if (!await saveLogbookNow(nextLogbook)) return;
    setActiveSheetId(id);
    setEditingSheetId(id);
    setSheetForm(sheetToForm(sheet));
    setShowNewSheet(false);
  }

  function startEditingBoat(boat: Boat) {
    setShowBoatManager(false);
    setEditingBoatId(boat.id);
    setBoatForm(boatToForm(boat));
  }

  function cancelBoatEdit() {
    setShowBoatManager(false);
    setEditingBoatId(selectedBoat.id);
    setBoatForm(boatToForm(selectedBoat));
  }

  function startEditingSheet(sheet: LogSheet) {
    setActiveSheetId(sheet.id);
    setShowNewSheet(false);
    setEditingSheetId(sheet.id);
    setSheetForm(sheetToForm(sheet));
  }

  function cancelSheetEdit() {
    setEditingSheetId(null);
    setSheetForm(defaultSheetForm(logbook.boats[0]?.id ?? seedBoats[0].id));
    setShowNewSheet(false);
  }

  async function saveLineFromFields() {
    const line: LogLine = {
      time: lineForm.time,
      position: lineForm.position,
      latitude: numberOrZero(lineForm.latitude),
      longitude: numberOrZero(lineForm.longitude),
      logNm: numberOrZero(lineForm.logNm),
      course: lineForm.course,
      magneticCourse: lineForm.magneticCourse,
      seaState: lineForm.seaState,
      barometer: lineForm.barometer,
      wind: lineForm.wind,
      weather: lineForm.weather,
      sails: lineForm.sails,
      engine: lineForm.engine,
      remarks: lineForm.remarks,
    };
    const currentLogbook = logbookRef.current;
    const nextLogbook = { ...currentLogbook, sheets: currentLogbook.sheets.map((sheet) => {
      if (sheet.id !== activeSheet.id) return sheet;
      const lines = editingLineIndex === null ? [...sheet.lines, line] : sheet.lines.map((candidate, index) => index === editingLineIndex ? line : candidate);
      const remarks = editingLineIndex === null && line.remarks ? [...sheet.remarks, line.remarks] : sheet.remarks;
      return { ...sheet, lines, remarks };
    }) };
    if (!await saveLogbookNow(nextLogbook)) return;
    setLineForm(defaultLineForm);
    setEditingLineIndex(null);
    setShowAddLine(false);
  }

  async function addLine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await saveLineFromFields();
  }

  function startEditingLine(line: LogLine, index: number) {
    setEditingLineIndex(index);
    setLineForm(lineToForm(line));
    setShowAddLine(false);
  }

  function startAddingLine() {
    setEditingLineIndex(null);
    setLineForm(defaultLineForm);
    setShowAddLine((show) => !show);
  }

  function cancelLineEdit() {
    setEditingLineIndex(null);
    setLineForm(defaultLineForm);
    setShowAddLine(false);
  }

  async function saveCrew() {
    const crew = { ...crewForm };
    const currentLogbook = logbookRef.current;
    const currentSheet = currentLogbook.sheets.find((sheet) => sheet.id === activeSheet.id) ?? activeSheet;
    const nextLogbook = { ...currentLogbook, sheets: currentLogbook.sheets.map((sheet) => {
      if (sheet.id !== activeSheet.id) return sheet;
      const nextCrew = selectedCrewIndex < 0 ? [...sheet.crew, crew] : sheet.crew.map((candidate, index) => index === selectedCrewIndex ? crew : candidate);
      return { ...sheet, crew: nextCrew };
    }) };
    if (!await saveLogbookNow(nextLogbook)) return;
    if (selectedCrewIndex < 0) setSelectedCrewIndex(currentSheet.crew.length);
  }

  function selectCrew(index: number) {
    setSelectedCrewIndex(index);
    setLastCrewIndex(index);
    setCrewForm(crewToForm(activeSheet.crew[index] ?? defaultCrewForm));
  }

  function cancelCrewEdit() {
    const nextIndex = Math.min(lastCrewIndex, Math.max(activeSheet.crew.length - 1, 0));
    setSelectedCrewIndex(nextIndex);
    setCrewForm(crewToForm(activeSheet.crew[nextIndex] ?? defaultCrewForm));
  }

  return (
    <main className="app-shell">
      <div className="fixed right-4 top-4 z-50 text-right">
        {userEmail && <span className="mr-3 rounded-full bg-slate-950/70 px-3 py-2 text-sm text-white shadow">{userEmail}</span>}
        <button className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 shadow disabled:opacity-60" disabled={isLoggingOut} onClick={logout} type="button">{isLoggingOut ? "Saving…" : "Logout"}</button>
        {saveError && <p className="mt-2 max-w-xs rounded-xl bg-red-600 px-3 py-2 text-left text-xs font-semibold text-white shadow">{saveError}</p>}
      </div>
      <ModuleTabs activeModule={activeModule} onSelectModule={setActiveModule} />

      {activeModule === "dashboard" && <DashboardPanel stats={stats} />}

      <section className="workspace module-workspace">
        {activeModule === "logbooks" && <aside className="sidebar module-panel" aria-label="Log sheets">
          <div className="sidebar-header">
            <p className="eyebrow">Sheets</p>
            <button type="button" onClick={() => { setEditingSheetId(null); setSheetForm(defaultSheetForm(activeBoat.id)); setShowNewSheet(true); setActiveModule("details"); }}>+ New sheet</button>
          </div>

          <div className="sheet-list" aria-label="Available log sheets">{logbook.sheets.map((sheet) => {
            const boat = logbook.boats.find((candidate) => candidate.id === sheet.boatId);
            return <div className={`sheet-button-row ${sheet.id === activeSheet.id ? "active" : ""}`} key={sheet.id}><button className="sheet-button sheet-card" onClick={() => { setActiveSheetId(sheet.id); setSheetForm(sheetToForm(sheet)); setActiveModule("details"); }} type="button"><span className="picture-thumb" aria-hidden="true" /><span>{sheet.title}</span><small>{sheet.dateRange} · {boat?.name}</small></button></div>;
          })}</div>
        </aside>}

        {activeModule === "details" && <section className="sheet-detail" aria-labelledby="sheet-title">
          {(activeModule === "details") ? (
            <form className="sheet-title-row inline-edit-card" onSubmit={saveSheet}>
              <div className="inline-edit-grid">
                <p className="eyebrow">{editingSheetId ? "Edit sheet" : "New sheet"}</p>
                <label>Title<input required value={sheetForm.title} onChange={(e) => setSheetForm({ ...sheetForm, title: e.target.value })} /></label>
                <label>Boat<select value={sheetForm.boatId} onChange={(e) => setSheetForm({ ...sheetForm, boatId: e.target.value })}>{logbook.boats.map((boat) => <option key={boat.id} value={boat.id}>{boat.name}</option>)}</select></label>
                <label>Date<input type="date" value={sheetForm.dateRange} onChange={(e) => setSheetForm({ ...sheetForm, dateRange: e.target.value })} /></label>
                <label>Day goal<input value={sheetForm.dayGoal} onChange={(e) => setSheetForm({ ...sheetForm, dayGoal: e.target.value })} /></label>
                <label>From<input value={sheetForm.from} onChange={(e) => setSheetForm({ ...sheetForm, from: e.target.value })} /></label>
                <label>To<input value={sheetForm.to} onChange={(e) => setSheetForm({ ...sheetForm, to: e.target.value })} /></label>
                <label>Position morning<input value={sheetForm.morningPosition} onChange={(e) => setSheetForm({ ...sheetForm, morningPosition: e.target.value })} /></label>
                <label>Position evening<input value={sheetForm.eveningPosition} onChange={(e) => setSheetForm({ ...sheetForm, eveningPosition: e.target.value })} /></label>
              </div>
              <div className="inline-edit-actions"><button type="submit">Save</button>{showNewSheet ? <button type="button" className="ghost-button" onClick={() => { cancelSheetEdit(); setActiveModule("logbooks"); }}>Cancel</button> : <button type="button" className="ghost-button" onClick={() => setSheetForm(sheetToForm(activeSheet))}>Discard changes</button>}</div>
            </form>
          ) : (
            <>
              <div className="sheet-title-row"><div><p className="eyebrow">Active sheet</p><h2 id="sheet-title">{activeSheet.title}</h2><p>{activeSheet.route.from} → {activeSheet.route.to} · {activeSheet.dateRange}</p></div><div className="inline-edit-actions"><span className="status-pill">{activeSheet.status}</span><button type="button" className="edit-chip" onClick={() => startEditingSheet(activeSheet)}>Edit sheet</button></div></div>
              <section className="paper-header" aria-label="Daily paper log header"><div><span>Day goal</span><strong>{activeSheet.route.dayGoal || "—"}</strong></div><div><span>Date</span><strong>{activeSheet.dateRange}</strong></div><div><span>Daily logbook lead</span><strong>{activeSheet.skipper.name}</strong></div><div><span>Stage / sheet</span><strong>{activeSheet.id}</strong></div><div><span>Position morning</span><strong>{activeSheet.route.morningPosition || "—"}</strong></div><div><span>Position evening</span><strong>{activeSheet.route.eveningPosition || "—"}</strong></div></section>
            </>
          )}

          <div className="detail-grid"><article className="info-card"><div className="card-title-row"><h3>Boat</h3><button type="button" className="edit-chip" onClick={() => { setSelectedBoatId(activeBoat.id); setEditingBoatId(activeBoat.id); setBoatForm(boatToForm(activeBoat)); setShowBoatManager(false); setActiveModule("boats"); }}>Show boat details</button></div><dl><div><dt>Selected boat</dt><dd>{activeBoat.name}</dd></div><div><dt>Type</dt><dd>{activeBoat.type}</dd></div></dl></article><article className="info-card"><h3>Skipper & ports</h3><dl><div><dt>Skipper</dt><dd>{activeSheet.skipper.name}</dd></div><div><dt>Address</dt><dd>{activeSheet.skipper.address}</dd></div><div><dt>Nationality</dt><dd>{activeSheet.skipper.nationality}</dd></div><div><dt>Certificate</dt><dd>{activeSheet.skipper.certificate}</dd></div><div><dt>Departure</dt><dd>{activeSheet.route.departed}</dd></div><div><dt>Arrival</dt><dd>{activeSheet.route.arrived}</dd></div></dl></article></div>
          <div className="voyage-layout"><article className="map-card"><div><p className="eyebrow">Route map draft</p><h3>Positions connected from log lines</h3></div><div className="route-map" aria-label="Stylized route map preview">{activeSheet.lines.map((line, index) => <span className="map-marker" key={`${line.time}-${line.position}-${index}`} style={{ left: `${12 + index * (76 / Math.max(activeSheet.lines.length - 1, 1))}%`, top: `${62 - index * 8}%` }} title={`${line.time} · ${line.position}`}>{index + 1}</span>)}</div></article>
          <article className="weather-card"><div><p className="eyebrow">Weather briefing</p><h3>Forecast, warnings, and planning context</h3></div><div className="briefing-grid"><div><span>Station</span><strong>{activeSheet.weatherBriefing.station || "—"}</strong></div><div><span>Time</span><strong>{activeSheet.weatherBriefing.time || "—"}</strong></div><div><span>Area</span><strong>{activeSheet.weatherBriefing.area || "—"}</strong></div><div className="wide"><span>Forecast</span><strong>{activeSheet.weatherBriefing.forecast || "—"}</strong></div><div className="wide"><span>Warnings</span><strong>{activeSheet.weatherBriefing.warnings || "—"}</strong></div></div></article></div>

          <article className="table-card"><div className="table-header"><div><p className="eyebrow">Combined day sheet</p><h3>Meteorological and nautical log lines</h3></div><div className="table-actions"><button type="button" onClick={() => setShowCourseColumns((show) => !show)}>{showCourseColumns ? "Hide" : "Show"} course conversion columns</button><button type="button" onClick={startAddingLine}>+ Add line</button></div></div><div className="table-scroll"><table className={showCourseColumns ? "with-course-columns" : undefined}><thead><tr><th>Time</th><th>Weather</th><th>Baro</th><th>Sea</th><th>Wind</th><th>MgK / CC</th>{showCourseColumns && courseConversionColumns.map((column) => <th key={column}>{column}</th>)}<th>KüG / COG</th><th>Log</th><th>Sail</th><th>Motor</th><th>Position</th><th>Lat / Lon</th><th>Remarks</th><th>Actions</th></tr></thead><tbody>{showAddLine && <tr className="inline-line-row"><td><input value={lineForm.time} onChange={(e) => setLineForm({ ...lineForm, time: e.target.value })} /></td><td><input value={lineForm.weather} onChange={(e) => setLineForm({ ...lineForm, weather: e.target.value })} /></td><td><input value={lineForm.barometer} onChange={(e) => setLineForm({ ...lineForm, barometer: e.target.value })} /></td><td><input value={lineForm.seaState} onChange={(e) => setLineForm({ ...lineForm, seaState: e.target.value })} /></td><td><input value={lineForm.wind} onChange={(e) => setLineForm({ ...lineForm, wind: e.target.value })} /></td><td><input value={lineForm.magneticCourse} onChange={(e) => setLineForm({ ...lineForm, magneticCourse: e.target.value })} /></td>{showCourseColumns && courseConversionColumns.map((column) => <td className="optional-course-cell" key={`new-${column}`}>—</td>)}<td><input value={lineForm.course} onChange={(e) => setLineForm({ ...lineForm, course: e.target.value })} /></td><td><input value={lineForm.logNm} onChange={(e) => setLineForm({ ...lineForm, logNm: e.target.value })} /></td><td><input value={lineForm.sails} onChange={(e) => setLineForm({ ...lineForm, sails: e.target.value })} /></td><td><input value={lineForm.engine} onChange={(e) => setLineForm({ ...lineForm, engine: e.target.value })} /></td><td><input value={lineForm.position} onChange={(e) => setLineForm({ ...lineForm, position: e.target.value })} /></td><td><div className="coordinate-inputs"><input aria-label="Latitude" value={lineForm.latitude} onChange={(e) => setLineForm({ ...lineForm, latitude: e.target.value })} /><input aria-label="Longitude" value={lineForm.longitude} onChange={(e) => setLineForm({ ...lineForm, longitude: e.target.value })} /></div></td><td><input value={lineForm.remarks} onChange={(e) => setLineForm({ ...lineForm, remarks: e.target.value })} /></td><td><div className="table-actions"><button type="button" onClick={saveLineFromFields}>{editingLineIndex === null ? "Save line" : "Update line"}</button><button type="button" className="ghost-button" onClick={cancelLineEdit}>Cancel</button></div></td></tr>}{activeSheet.lines.map((line, index) => editingLineIndex === index ? <tr key={`edit-${index}`} className="inline-line-row"><td><input value={lineForm.time} onChange={(e) => setLineForm({ ...lineForm, time: e.target.value })} /></td><td><input value={lineForm.weather} onChange={(e) => setLineForm({ ...lineForm, weather: e.target.value })} /></td><td><input value={lineForm.barometer} onChange={(e) => setLineForm({ ...lineForm, barometer: e.target.value })} /></td><td><input value={lineForm.seaState} onChange={(e) => setLineForm({ ...lineForm, seaState: e.target.value })} /></td><td><input value={lineForm.wind} onChange={(e) => setLineForm({ ...lineForm, wind: e.target.value })} /></td><td><input value={lineForm.magneticCourse} onChange={(e) => setLineForm({ ...lineForm, magneticCourse: e.target.value })} /></td>{showCourseColumns && courseConversionColumns.map((column) => <td className="optional-course-cell" key={`new-${column}`}>—</td>)}<td><input value={lineForm.course} onChange={(e) => setLineForm({ ...lineForm, course: e.target.value })} /></td><td><input value={lineForm.logNm} onChange={(e) => setLineForm({ ...lineForm, logNm: e.target.value })} /></td><td><input value={lineForm.sails} onChange={(e) => setLineForm({ ...lineForm, sails: e.target.value })} /></td><td><input value={lineForm.engine} onChange={(e) => setLineForm({ ...lineForm, engine: e.target.value })} /></td><td><input value={lineForm.position} onChange={(e) => setLineForm({ ...lineForm, position: e.target.value })} /></td><td><div className="coordinate-inputs"><input aria-label="Latitude" value={lineForm.latitude} onChange={(e) => setLineForm({ ...lineForm, latitude: e.target.value })} /><input aria-label="Longitude" value={lineForm.longitude} onChange={(e) => setLineForm({ ...lineForm, longitude: e.target.value })} /></div></td><td><input value={lineForm.remarks} onChange={(e) => setLineForm({ ...lineForm, remarks: e.target.value })} /></td><td><div className="table-actions"><button type="button" onClick={saveLineFromFields}>{editingLineIndex === null ? "Save line" : "Update line"}</button><button type="button" className="ghost-button" onClick={cancelLineEdit}>Cancel</button></div></td></tr> : <tr key={`${line.time}-${line.position}-${index}`}><td>{line.time}</td><td>{line.weather}</td><td>{line.barometer}</td><td>{line.seaState}</td><td>{line.wind}</td><td>{line.magneticCourse}</td>{showCourseColumns && courseConversionColumns.map((column) => <td className="optional-course-cell" key={`${line.time}-${index}-${column}`}>—</td>)}<td>{line.course}</td><td>{line.logNm} nm</td><td>{line.sails}</td><td>{line.engine}</td><td>{line.position}</td><td>{line.latitude.toFixed(3)} / {line.longitude.toFixed(3)}</td><td>{line.remarks}</td><td><button type="button" className="edit-chip" onClick={() => startEditingLine(line, index)}>Edit</button></td></tr>)}</tbody></table></div></article>

          <div className="paper-grid"><article className="remarks-card"><div><p className="eyebrow">Remarks</p><h3>Maneuvers, observations, events, and lightkeeping</h3></div><ol>{activeSheet.remarks.map((remark, index) => <li key={`${remark}-${index}`}>{remark}</li>)}</ol></article><article className="summary-card"><div><p className="eyebrow">Tour summary</p><h3>Törnzusammenfassung</h3></div><dl><div><dt>Area</dt><dd>{activeSheet.daySummary.area || "—"}</dd></div><div><dt>Night hours</dt><dd>{activeSheet.daySummary.nightHours}</dd></div><div><dt>Days on board</dt><dd>{activeSheet.daySummary.daysOnBoard}</dd></div><div><dt>Sailing miles</dt><dd>{activeSheet.daySummary.sailingMiles} nm</dd></div><div><dt>Motor miles</dt><dd>{activeSheet.daySummary.motorMiles} nm</dd></div><div><dt>Outside FB2</dt><dd>{activeSheet.daySummary.outsideFb2Miles} nm</dd></div><div><dt>Engine hours</dt><dd>{activeSheet.daySummary.engineHoursStart} → {activeSheet.daySummary.engineHoursEnd}</dd></div></dl></article></div>
          <div className="bottom-grid"><article className="info-card"><h3>Crew for this sheet</h3><ul className="stack-list">{activeSheet.crew.map((person) => <li key={person.name}><strong>{person.name}</strong><span>{person.nationality} · {person.role}</span><small>{person.embarkation} → {person.disembarkation}</small></li>)}</ul></article><article className="info-card"><h3>Watch & daily checks</h3><ul className="check-list">{[...activeSheet.watchPlan, ...activeSheet.technicalChecks].map((item) => <li key={item}>{item}</li>)}</ul></article></div>
          <article className="compliance-card"><div><p className="eyebrow">Swiss compliance checklist</p><h3>Built from Hochseeausweis logbook requirements</h3></div><ul>{legalRequirements.map((requirement) => <li key={requirement}>{requirement}</li>)}</ul></article>
          <article className="signature-card"><div><span>Logbook lead</span><strong>{activeSheet.skipper.name}</strong></div><div><span>Skipper</span><strong>{activeSheet.skipper.name}</strong></div><div><span>Digital personal-log status</span><strong>{activeSheet.status}</strong></div></article>
        </section>}

        {activeModule === "boats" && <section className="sheet-detail module-panel"><ManagerShell title="Boats" split={boatSplit} newLabel="New boat" onNew={() => { setEditingBoatId(null); setBoatForm(defaultBoatForm); setShowBoatManager(true); }} onToggleSplit={() => setBoatSplit((split) => split === "vertical" ? "horizontal" : "vertical")} list={<ul className="manager-list">{logbook.boats.map((boat) => <li key={boat.id}><button type="button" className={boat.id === selectedBoat.id ? "active" : ""} onClick={() => { setSelectedBoatId(boat.id); setEditingBoatId(boat.id); setBoatForm(boatToForm(boat)); setShowBoatManager(false); }}><span className="picture-thumb" aria-hidden="true" /><span><strong>{boat.name}</strong><small>{boat.type} · {boat.registration || "No registration"}</small></span></button></li>)}</ul>} form={<form className="inline-edit-grid" onSubmit={saveBoat}><p className="eyebrow">{showBoatManager ? "New boat" : "Boat form"}</p><label>Name<input required value={boatForm.name} onChange={(e) => setBoatForm({ ...boatForm, name: e.target.value })} /></label><label>Type<select value={boatForm.type} onChange={(e) => setBoatForm({ ...boatForm, type: e.target.value as BoatType })}><option>Sail</option><option>Motor</option></select></label><label>Registration<input value={boatForm.registration} onChange={(e) => setBoatForm({ ...boatForm, registration: e.target.value })} /></label><label>Flag state<input value={boatForm.flagState} onChange={(e) => setBoatForm({ ...boatForm, flagState: e.target.value })} /></label><label>Home port<input value={boatForm.homePort} onChange={(e) => setBoatForm({ ...boatForm, homePort: e.target.value })} /></label><label>Owner<input value={boatForm.owner} onChange={(e) => setBoatForm({ ...boatForm, owner: e.target.value })} /></label><label>Dimensions<input value={boatForm.dimensions} onChange={(e) => setBoatForm({ ...boatForm, dimensions: e.target.value })} /></label><label>Manufacturer<input value={boatForm.manufacturer} onChange={(e) => setBoatForm({ ...boatForm, manufacturer: e.target.value })} /></label><label>MMSI<input value={boatForm.mmsi} onChange={(e) => setBoatForm({ ...boatForm, mmsi: e.target.value })} /></label><label>Engine<input value={boatForm.engine} onChange={(e) => setBoatForm({ ...boatForm, engine: e.target.value })} /></label><label className="wide-field">Safety<textarea value={boatForm.safety} onChange={(e) => setBoatForm({ ...boatForm, safety: e.target.value })} /></label><div className="inline-edit-actions"><button type="submit">{showBoatManager ? "Create boat" : "Save boat"}</button><button type="button" className="ghost-button" onClick={cancelBoatEdit}>Cancel</button></div></form>} /></section>}

        {activeModule === "crew" && <section className="sheet-detail module-panel"><ManagerShell title="Crew" split={crewSplit} newLabel="New crew" onNew={() => { setLastCrewIndex(selectedCrewIndex >= 0 ? selectedCrewIndex : lastCrewIndex); setSelectedCrewIndex(-1); setCrewForm(defaultCrewForm); }} onToggleSplit={() => setCrewSplit((split) => split === "vertical" ? "horizontal" : "vertical")} list={<ul className="manager-list">{activeSheet.crew.map((person, index) => <li key={person.name}><button type="button" className={index === selectedCrewIndex ? "active" : ""} onClick={() => selectCrew(index)}><span className="picture-thumb" aria-hidden="true" /><span><strong>{person.name}</strong><small>{person.role}</small></span></button></li>)}</ul>} form={<form className="inline-edit-grid" onSubmit={async (event) => { event.preventDefault(); await saveCrew(); }}><p className="eyebrow">{selectedCrewIndex < 0 ? "New crew" : "Crew form"}</p><label>Name<input value={crewForm.name} onChange={(e) => setCrewForm({ ...crewForm, name: e.target.value })} /></label><label>Nationality<input value={crewForm.nationality} onChange={(e) => setCrewForm({ ...crewForm, nationality: e.target.value })} /></label><label>Role<input value={crewForm.role} onChange={(e) => setCrewForm({ ...crewForm, role: e.target.value })} /></label><label>Embarkation<input value={crewForm.embarkation} onChange={(e) => setCrewForm({ ...crewForm, embarkation: e.target.value })} /></label><label>Disembarkation<input value={crewForm.disembarkation} onChange={(e) => setCrewForm({ ...crewForm, disembarkation: e.target.value })} /></label><div className="inline-edit-actions"><button type="submit">Save crew</button><button type="button" className="ghost-button" onClick={cancelCrewEdit}>Cancel</button></div></form>} /></section>}

        {activeModule === "compliance" && <section className="sheet-detail module-panel"><article className="compliance-card"><div><p className="eyebrow">Swiss compliance checklist</p><h3>Built from Hochseeausweis logbook requirements</h3></div><ul>{legalRequirements.map((requirement) => <li key={requirement}>{requirement}</li>)}</ul></article></section>}
      </section>
    </main>
  );
}

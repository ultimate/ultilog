"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { boats as seedBoats, defaultDeviationTable, logSheets as seedSheets, normalizeDeviationTable, type Boat, type BoatForm, type BoatType, type CrewForm, type LineForm, type LogLine, type LogSheet, type PersistedLogbook, type SheetForm } from "../data/logbook";
import { ManagerShell, type SplitDirection } from "./managers/ManagerShell";
import { courseConversionColumns } from "../domain/nautical/course-conversion";
import { moduleTabs, type ModuleTab } from "../templates/app-shell";
import { ModuleTabs, type ActiveView } from "../templates/ModuleTabs";
import { DashboardPanel } from "../templates/DashboardPanel";
import { legalRequirements } from "../templates/compliance";

const defaultSheetForm = (boatId: string): SheetForm => ({ title: "", dateRange: new Date().toISOString().slice(0, 10), boatId, dayGoal: "", from: "", to: "", morningPosition: "", eveningPosition: "" });
const defaultBoatForm: BoatForm = { name: "", type: "Sail", registration: "", flagState: "", homePort: "", owner: "", dimensions: "", manufacturer: "", mmsi: "", engine: "", safety: "", deviationTable: defaultDeviationTable() };
const defaultLineForm: LineForm = { time: "", position: "", latitude: "", longitude: "", logNm: "", course: "", magneticCourse: "", seaState: "", barometer: "", wind: "", weather: "", sails: "", engine: "", remarks: "" };
const defaultCrewForm: CrewForm = { name: "", nationality: "", role: "", embarkation: "", disembarkation: "" };
const defaultLogbook: PersistedLogbook = { boats: seedBoats, sheets: seedSheets };
const boatToForm = (boat: Boat): BoatForm => ({ name: boat.name, type: boat.type, registration: boat.registration, flagState: boat.flagState, homePort: boat.homePort, owner: boat.owner, dimensions: boat.dimensions, manufacturer: boat.yachtData.Manufacturer === "—" ? "" : boat.yachtData.Manufacturer, mmsi: boat.yachtData.MMSI === "—" ? "" : boat.yachtData.MMSI, engine: boat.yachtData.Engine === "—" ? "" : boat.yachtData.Engine, safety: boat.yachtData.Safety === "To be completed" ? "" : boat.yachtData.Safety, deviationTable: normalizeDeviationTable(boat.deviationTable) });
const sheetToForm = (sheet: LogSheet): SheetForm => ({ title: sheet.title, dateRange: sheet.dateRange, boatId: sheet.boatId, dayGoal: sheet.route.dayGoal, from: sheet.route.from, to: sheet.route.to, morningPosition: sheet.route.morningPosition, eveningPosition: sheet.route.eveningPosition });
const lineToForm = (line: LogLine): LineForm => ({ time: line.time, position: line.position, latitude: line.latitude.toString(), longitude: line.longitude.toString(), logNm: line.logNm.toString(), course: line.course, magneticCourse: line.magneticCourse, seaState: line.seaState, barometer: line.barometer, wind: line.wind, weather: line.weather, sails: line.sails, engine: line.engine, remarks: line.remarks });
const crewToForm = (crew: CrewForm): CrewForm => ({ name: crew.name, nationality: crew.nationality, role: crew.role, embarkation: crew.embarkation, disembarkation: crew.disembarkation });

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const createId = () => crypto.randomUUID();
const isOpaqueId = (id: string) => uuidPattern.test(id);
const numberOrZero = (value: string) => Number.parseFloat(value) || 0;
const routedModules = new Set<ActiveView>([...moduleTabs.map((tab) => tab.id), "profile"]);
const modulePath = (module: ActiveView, itemId?: string | number) => `/${module}${itemId !== undefined && itemId !== null ? `/${encodeURIComponent(String(itemId))}` : ""}`;

type RouteState = { view: ActiveView; itemId?: string };

function routeFromPathname(pathname: string): RouteState {
  const [, moduleSegment, itemSegment] = pathname.split("/");
  const view = routedModules.has(moduleSegment as ActiveView) ? moduleSegment as ActiveView : "dashboard";
  return { view, itemId: itemSegment ? decodeURIComponent(itemSegment) : undefined };
}

function normalizeLogbookIds(logbook: PersistedLogbook): { logbook: PersistedLogbook; changed: boolean; boatIds: Map<string, string>; sheetIds: Map<string, string> } {
  const boatIds = new Map<string, string>();
  const sheetIds = new Map<string, string>();
  let changed = false;

  for (const boat of logbook.boats) {
    if (!isOpaqueId(boat.id)) {
      boatIds.set(boat.id, createId());
      changed = true;
    }
  }
  for (const sheet of logbook.sheets) {
    if (!isOpaqueId(sheet.id)) {
      sheetIds.set(sheet.id, createId());
      changed = true;
    }
    if (boatIds.has(sheet.boatId)) changed = true;
  }

  if (!changed) return { logbook, changed, boatIds, sheetIds };
  return {
    changed,
    boatIds,
    sheetIds,
    logbook: {
      boats: logbook.boats.map((boat) => ({ ...boat, id: boatIds.get(boat.id) ?? boat.id })),
      sheets: logbook.sheets.map((sheet) => ({ ...sheet, id: sheetIds.get(sheet.id) ?? sheet.id, boatId: boatIds.get(sheet.boatId) ?? sheet.boatId })),
    },
  };
}

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
  const pathname = usePathname();
  const [logbook, setLogbook] = useState<PersistedLogbook>(defaultLogbook);
  const [activeSheetId, setActiveSheetId] = useState(defaultLogbook.sheets[0].id);
  const [isBackendReady, setIsBackendReady] = useState(false);
  const [routePath, setRoutePath] = useState(pathname);
  const [activeModule, setActiveModule] = useState<ActiveView>("dashboard");
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
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [isNavSlim, setIsNavSlim] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const logbookRef = useRef(logbook);

  function pushAppPath(path: string) {
    if (path === routePath) return;
    window.history.pushState(null, "", path);
    setRoutePath(path);
  }

  function navigate(module: ActiveView, itemId?: string | number) {
    setActiveModule(module);
    pushAppPath(modulePath(module, itemId));
  }

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
      const { logbook: normalizedLogbook, changed, boatIds, sheetIds } = normalizeLogbookIds(storedLogbook);
      if (!isMounted) return;
      const route = routeFromPathname(window.location.pathname);
      const normalizedItemId = route.view === "boats" && route.itemId ? boatIds.get(route.itemId) : route.itemId && (route.view === "details" || route.view === "logbooks") ? sheetIds.get(route.itemId) : undefined;
      const nextRoute = normalizedItemId ? { ...route, itemId: normalizedItemId } : route;
      const nextRoutePath = normalizedItemId ? modulePath(route.view, normalizedItemId) : window.location.pathname;
      const routedSheet = nextRoute.itemId && (nextRoute.view === "details" || nextRoute.view === "logbooks") ? normalizedLogbook.sheets.find((sheet) => sheet.id === nextRoute.itemId) : undefined;
      const routedBoat = nextRoute.itemId && nextRoute.view === "boats" ? normalizedLogbook.boats.find((boat) => boat.id === nextRoute.itemId) : undefined;
      const fallbackSheet = normalizedLogbook.sheets[0] ?? defaultLogbook.sheets[0];
      const fallbackBoat = normalizedLogbook.boats[0] ?? seedBoats[0];
      const nextSheet = routedSheet ?? fallbackSheet;
      const nextBoat = routedBoat ?? fallbackBoat;

      logbookRef.current = normalizedLogbook;
      setLogbook(normalizedLogbook);
      setActiveSheetId(nextSheet.id);
      setSheetForm(routedSheet ? sheetToForm(routedSheet) : (current) => ({ ...current, boatId: fallbackBoat.id }));
      setSelectedBoatId(nextBoat.id);
      if (routedBoat) {
        setEditingBoatId(routedBoat.id);
        setBoatForm(boatToForm(routedBoat));
        setShowBoatManager(false);
      }
      if (nextRoute.view === "crew" && nextRoute.itemId) {
        const crewIndex = Number.parseInt(nextRoute.itemId, 10);
        if (Number.isInteger(crewIndex) && crewIndex >= 0 && crewIndex < nextSheet.crew.length) {
          setSelectedCrewIndex(crewIndex);
          setLastCrewIndex(crewIndex);
          setCrewForm(crewToForm(nextSheet.crew[crewIndex] ?? defaultCrewForm));
        }
      }
      if (normalizedItemId) {
        window.history.replaceState(null, "", nextRoutePath);
        setRoutePath(nextRoutePath);
      }
      if (changed) persistLogbook(normalizedLogbook).catch(() => undefined);
      setIsBackendReady(true);
    }
    loadLogbook().catch(() => setIsBackendReady(true));
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    // Keep direct Next.js navigations and browser history changes in sync without
    // using router.push for in-app module changes, which would remount/refetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRoutePath(pathname);
  }, [pathname]);

  useEffect(() => {
    const syncFromHistory = () => setRoutePath(window.location.pathname);
    window.addEventListener("popstate", syncFromHistory);
    return () => window.removeEventListener("popstate", syncFromHistory);
  }, []);

  useEffect(() => {
    const { view, itemId } = routeFromPathname(routePath);
    // Route changes are the source of truth for browser back/forward and bookmarks.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveModule(view);
    if (view === "details" && itemId && logbook.sheets.some((sheet) => sheet.id === itemId)) {
      const sheet = logbook.sheets.find((candidate) => candidate.id === itemId);
      setActiveSheetId(itemId);
      if (sheet) setSheetForm(sheetToForm(sheet));
    }
    if (view === "logbooks" && itemId && logbook.sheets.some((sheet) => sheet.id === itemId)) {
      const sheet = logbook.sheets.find((candidate) => candidate.id === itemId);
      setActiveSheetId(itemId);
      if (sheet) setSheetForm(sheetToForm(sheet));
    }
    if (view === "boats" && itemId && logbook.boats.some((boat) => boat.id === itemId)) {
      const boat = logbook.boats.find((candidate) => candidate.id === itemId);
      setSelectedBoatId(itemId);
      setEditingBoatId(itemId);
      if (boat) setBoatForm(boatToForm(boat));
      setShowBoatManager(false);
    }
    if (view === "crew" && itemId) {
      const currentSheet = logbook.sheets.find((sheet) => sheet.id === activeSheetId) ?? logbook.sheets[0];
      const index = Number.parseInt(itemId, 10);
      if (Number.isInteger(index) && index >= 0 && index < (currentSheet?.crew.length ?? 0)) {
        setSelectedCrewIndex(index);
        setLastCrewIndex(index);
        setCrewForm(crewToForm(currentSheet.crew[index] ?? defaultCrewForm));
      }
    }
  }, [routePath, logbook, activeSheetId]);

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
    const id = editingBoatId ?? createId();
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
      deviationTable: normalizeDeviationTable(boatForm.deviationTable),
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
    pushAppPath(modulePath("boats", id));
    setSelectedBoatId(id);
    setSheetForm((current) => ({ ...current, boatId: id }));
  }

  async function saveSheet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const currentLogbook = logbookRef.current;
    const existingSheet = editingSheetId ? currentLogbook.sheets.find((sheet) => sheet.id === editingSheetId) : undefined;
    const base = existingSheet ?? seedSheets[0];
    const id = editingSheetId ?? createId();
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
    setEditingSheetId(null);
    setSheetForm(sheetToForm(sheet));
    setShowNewSheet(false);
    pushAppPath(modulePath("details", id));
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
    if (selectedCrewIndex < 0) {
      const nextIndex = currentSheet.crew.length;
      setSelectedCrewIndex(nextIndex);
      pushAppPath(modulePath("crew", nextIndex));
    }
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
    <main className="app-shell" data-theme={theme} data-nav={isNavSlim ? "slim" : "full"}>
      <ModuleTabs activeModule={activeModule} onSelectModule={(module) => navigate(module)} onOpenProfile={() => navigate("profile")} theme={theme} onToggleTheme={() => setTheme((current) => current === "dark" ? "light" : "dark")} userEmail={userEmail} isNavSlim={isNavSlim} onToggleNavSlim={() => setIsNavSlim((current) => !current)} onLogout={logout} isLoggingOut={isLoggingOut} />
      <section className="app-content">
      <div className="top-actions">
        {saveError && <p className="save-error">{saveError}</p>}
        <button className="secondary-action" type="button">Export</button>
        <button className="primary-action" type="button" onClick={() => { setEditingSheetId(null); setSheetForm(defaultSheetForm(activeBoat.id)); setShowNewSheet(true); navigate("details"); }}>+ New log entry</button>
      </div>

      {activeModule === "dashboard" && <DashboardPanel stats={stats} />}

      <section className="workspace module-workspace">
        {activeModule === "logbooks" && <section className="logbook-page module-panel" aria-label="Log sheets">
          <div className="page-heading">
            <div><h1>Logbooks</h1><p>Manage all your logbook entries</p></div>
            <button type="button" className="primary-action" onClick={() => { setEditingSheetId(null); setSheetForm(defaultSheetForm(activeBoat.id)); setShowNewSheet(true); navigate("details"); }}>+ New sheet</button>
          </div>
          <div className="logbook-toolbar"><input aria-label="Search logbooks" placeholder="Search logbooks…" readOnly /><select aria-label="Vessel filter" defaultValue="All vessels"><option>All vessels</option></select><select aria-label="Time filter" defaultValue="All time"><option>All time</option></select></div>
          <article className="table-card logbook-list-card">
            <div className="table-scroll"><table className="logbook-table"><thead><tr><th>Date</th><th>Entry</th><th>Vessel</th><th>From → To</th><th>Sail miles</th><th>Motor miles</th><th>Total miles</th><th></th></tr></thead><tbody>{logbook.sheets.map((sheet) => {
              const boat = logbook.boats.find((candidate) => candidate.id === sheet.boatId);
              const totalMiles = Math.max(0, ...sheet.lines.map((line) => line.logNm));
              const motorMiles = sheet.daySummary.motorMiles || Math.round(totalMiles * 0.12);
              const sailMiles = Math.max(0, totalMiles - motorMiles);
              return <tr key={sheet.id}><td>{sheet.dateRange}</td><td><button className="table-title-button" onClick={() => { setActiveSheetId(sheet.id); setSheetForm(sheetToForm(sheet)); navigate("details", sheet.id); }} type="button">{sheet.title}</button></td><td><span className="table-vessel"><span className="picture-thumb" aria-hidden="true" />{boat?.name}</span></td><td>{sheet.route.from} → {sheet.route.to}</td><td>{sailMiles} nm</td><td>{motorMiles} nm</td><td>{totalMiles} nm</td><td><button className="edit-chip" onClick={() => { setActiveSheetId(sheet.id); setSheetForm(sheetToForm(sheet)); navigate("details", sheet.id); }} type="button">Open</button></td></tr>;
            })}</tbody></table></div>
            <div className="pagination-mock" aria-hidden="true"><span className="active">1</span><span>2</span><span>3</span><span>…</span><span>8</span><span>›</span></div>
          </article>
        </section>}

        {activeModule === "details" && <section className="sheet-detail" aria-labelledby="sheet-title">
          {(showNewSheet || editingSheetId) ? (
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
              <div className="inline-edit-actions"><button type="submit">Save</button>{showNewSheet ? <button type="button" className="ghost-button" onClick={() => { cancelSheetEdit(); navigate("logbooks"); }}>Cancel</button> : <button type="button" className="ghost-button" onClick={() => setSheetForm(sheetToForm(activeSheet))}>Discard changes</button>}</div>
            </form>
          ) : (
            <>
              <div className="sheet-title-row"><div><p className="eyebrow">Active sheet</p><h2 id="sheet-title">{activeSheet.title}</h2><p>{activeSheet.route.from} → {activeSheet.route.to} · {activeSheet.dateRange}</p></div><div className="inline-edit-actions"><span className="status-pill">{activeSheet.status}</span><button type="button" className="edit-chip" onClick={() => startEditingSheet(activeSheet)}>Edit sheet</button></div></div>
              <section className="entry-metrics" aria-label="Logbook entry metrics"><article><span>Total miles</span><strong>{Math.max(0, ...activeSheet.lines.map((line) => line.logNm))} nm</strong></article><article><span>Sail miles</span><strong>{Math.max(0, Math.max(0, ...activeSheet.lines.map((line) => line.logNm)) - (activeSheet.daySummary.motorMiles || 12))} nm</strong></article><article><span>Motor miles</span><strong>{activeSheet.daySummary.motorMiles || 12} nm</strong></article><article><span>Duration</span><strong>18h 30m</strong></article></section><nav className="entry-tabs" aria-label="Entry sections"><span>Passage</span><span className="active">Mileage log</span><span>Crew ({activeSheet.crew.length})</span><span>Notes & documents</span><span>Sign-offs</span></nav><section className="paper-header" aria-label="Daily paper log header"><div><span>Day goal</span><strong>{activeSheet.route.dayGoal || "—"}</strong></div><div><span>Date</span><strong>{activeSheet.dateRange}</strong></div><div><span>Daily logbook lead</span><strong>{activeSheet.skipper.name}</strong></div><div><span>Stage / sheet</span><strong>{activeSheet.id}</strong></div><div><span>Position morning</span><strong>{activeSheet.route.morningPosition || "—"}</strong></div><div><span>Position evening</span><strong>{activeSheet.route.eveningPosition || "—"}</strong></div></section>
            </>
          )}

          <div className="detail-grid"><article className="info-card"><div className="card-title-row"><h3>Boat</h3><button type="button" className="edit-chip" onClick={() => { setSelectedBoatId(activeBoat.id); setEditingBoatId(activeBoat.id); setBoatForm(boatToForm(activeBoat)); setShowBoatManager(false); navigate("boats", activeBoat.id); }}>Show boat details</button></div><dl><div><dt>Selected boat</dt><dd>{activeBoat.name}</dd></div><div><dt>Type</dt><dd>{activeBoat.type}</dd></div></dl></article><article className="info-card"><h3>Skipper & ports</h3><dl><div><dt>Skipper</dt><dd>{activeSheet.skipper.name}</dd></div><div><dt>Address</dt><dd>{activeSheet.skipper.address}</dd></div><div><dt>Nationality</dt><dd>{activeSheet.skipper.nationality}</dd></div><div><dt>Certificate</dt><dd>{activeSheet.skipper.certificate}</dd></div><div><dt>Departure</dt><dd>{activeSheet.route.departed}</dd></div><div><dt>Arrival</dt><dd>{activeSheet.route.arrived}</dd></div></dl></article></div>
          <div className="voyage-layout"><article className="map-card"><div><p className="eyebrow">Route map draft</p><h3>Positions connected from log lines</h3></div><div className="route-map" aria-label="Stylized route map preview">{activeSheet.lines.map((line, index) => <span className="map-marker" key={`${line.time}-${line.position}-${index}`} style={{ left: `${12 + index * (76 / Math.max(activeSheet.lines.length - 1, 1))}%`, top: `${62 - index * 8}%` }} title={`${line.time} · ${line.position}`}>{index + 1}</span>)}</div></article>
          <article className="weather-card"><div><p className="eyebrow">Weather briefing</p><h3>Forecast, warnings, and planning context</h3></div><div className="briefing-grid"><div><span>Station</span><strong>{activeSheet.weatherBriefing.station || "—"}</strong></div><div><span>Time</span><strong>{activeSheet.weatherBriefing.time || "—"}</strong></div><div><span>Area</span><strong>{activeSheet.weatherBriefing.area || "—"}</strong></div><div className="wide"><span>Forecast</span><strong>{activeSheet.weatherBriefing.forecast || "—"}</strong></div><div className="wide"><span>Warnings</span><strong>{activeSheet.weatherBriefing.warnings || "—"}</strong></div></div></article></div>

          <article className="table-card"><div className="table-header"><div><p className="eyebrow">Combined day sheet</p><h3>Meteorological and nautical log lines</h3></div><div className="table-actions"><button type="button" onClick={() => setShowCourseColumns((show) => !show)}>{showCourseColumns ? "Hide" : "Show"} course conversion columns</button><button type="button" onClick={startAddingLine}>+ Add line</button></div></div><div className="table-scroll"><table className={showCourseColumns ? "with-course-columns" : undefined}><thead><tr><th>Time</th><th>Weather</th><th>Baro</th><th>Sea</th><th>Wind</th><th>MgK / CC</th>{showCourseColumns && courseConversionColumns.map((column) => <th key={column}>{column}</th>)}<th>KüG / COG</th><th>Log</th><th>Sail</th><th>Motor</th><th>Position</th><th>Lat / Lon</th><th>Remarks</th><th>Actions</th></tr></thead><tbody>{showAddLine && <tr className="inline-line-row"><td><input value={lineForm.time} onChange={(e) => setLineForm({ ...lineForm, time: e.target.value })} /></td><td><input value={lineForm.weather} onChange={(e) => setLineForm({ ...lineForm, weather: e.target.value })} /></td><td><input value={lineForm.barometer} onChange={(e) => setLineForm({ ...lineForm, barometer: e.target.value })} /></td><td><input value={lineForm.seaState} onChange={(e) => setLineForm({ ...lineForm, seaState: e.target.value })} /></td><td><input value={lineForm.wind} onChange={(e) => setLineForm({ ...lineForm, wind: e.target.value })} /></td><td><input value={lineForm.magneticCourse} onChange={(e) => setLineForm({ ...lineForm, magneticCourse: e.target.value })} /></td>{showCourseColumns && courseConversionColumns.map((column) => <td className="optional-course-cell" key={`new-${column}`}>—</td>)}<td><input value={lineForm.course} onChange={(e) => setLineForm({ ...lineForm, course: e.target.value })} /></td><td><input value={lineForm.logNm} onChange={(e) => setLineForm({ ...lineForm, logNm: e.target.value })} /></td><td><input value={lineForm.sails} onChange={(e) => setLineForm({ ...lineForm, sails: e.target.value })} /></td><td><input value={lineForm.engine} onChange={(e) => setLineForm({ ...lineForm, engine: e.target.value })} /></td><td><input value={lineForm.position} onChange={(e) => setLineForm({ ...lineForm, position: e.target.value })} /></td><td><div className="coordinate-inputs"><input aria-label="Latitude" value={lineForm.latitude} onChange={(e) => setLineForm({ ...lineForm, latitude: e.target.value })} /><input aria-label="Longitude" value={lineForm.longitude} onChange={(e) => setLineForm({ ...lineForm, longitude: e.target.value })} /></div></td><td><input value={lineForm.remarks} onChange={(e) => setLineForm({ ...lineForm, remarks: e.target.value })} /></td><td><div className="table-actions"><button type="button" onClick={saveLineFromFields}>{editingLineIndex === null ? "Save line" : "Update line"}</button><button type="button" className="ghost-button" onClick={cancelLineEdit}>Cancel</button></div></td></tr>}{activeSheet.lines.map((line, index) => editingLineIndex === index ? <tr key={`edit-${index}`} className="inline-line-row"><td><input value={lineForm.time} onChange={(e) => setLineForm({ ...lineForm, time: e.target.value })} /></td><td><input value={lineForm.weather} onChange={(e) => setLineForm({ ...lineForm, weather: e.target.value })} /></td><td><input value={lineForm.barometer} onChange={(e) => setLineForm({ ...lineForm, barometer: e.target.value })} /></td><td><input value={lineForm.seaState} onChange={(e) => setLineForm({ ...lineForm, seaState: e.target.value })} /></td><td><input value={lineForm.wind} onChange={(e) => setLineForm({ ...lineForm, wind: e.target.value })} /></td><td><input value={lineForm.magneticCourse} onChange={(e) => setLineForm({ ...lineForm, magneticCourse: e.target.value })} /></td>{showCourseColumns && courseConversionColumns.map((column) => <td className="optional-course-cell" key={`new-${column}`}>—</td>)}<td><input value={lineForm.course} onChange={(e) => setLineForm({ ...lineForm, course: e.target.value })} /></td><td><input value={lineForm.logNm} onChange={(e) => setLineForm({ ...lineForm, logNm: e.target.value })} /></td><td><input value={lineForm.sails} onChange={(e) => setLineForm({ ...lineForm, sails: e.target.value })} /></td><td><input value={lineForm.engine} onChange={(e) => setLineForm({ ...lineForm, engine: e.target.value })} /></td><td><input value={lineForm.position} onChange={(e) => setLineForm({ ...lineForm, position: e.target.value })} /></td><td><div className="coordinate-inputs"><input aria-label="Latitude" value={lineForm.latitude} onChange={(e) => setLineForm({ ...lineForm, latitude: e.target.value })} /><input aria-label="Longitude" value={lineForm.longitude} onChange={(e) => setLineForm({ ...lineForm, longitude: e.target.value })} /></div></td><td><input value={lineForm.remarks} onChange={(e) => setLineForm({ ...lineForm, remarks: e.target.value })} /></td><td><div className="table-actions"><button type="button" onClick={saveLineFromFields}>{editingLineIndex === null ? "Save line" : "Update line"}</button><button type="button" className="ghost-button" onClick={cancelLineEdit}>Cancel</button></div></td></tr> : <tr key={`${line.time}-${line.position}-${index}`}><td>{line.time}</td><td>{line.weather}</td><td>{line.barometer}</td><td>{line.seaState}</td><td>{line.wind}</td><td>{line.magneticCourse}</td>{showCourseColumns && courseConversionColumns.map((column) => <td className="optional-course-cell" key={`${line.time}-${index}-${column}`}>—</td>)}<td>{line.course}</td><td>{line.logNm} nm</td><td>{line.sails}</td><td>{line.engine}</td><td>{line.position}</td><td>{line.latitude.toFixed(3)} / {line.longitude.toFixed(3)}</td><td>{line.remarks}</td><td><button type="button" className="edit-chip" onClick={() => startEditingLine(line, index)}>Edit</button></td></tr>)}</tbody></table></div></article>

          <div className="paper-grid"><article className="remarks-card"><div><p className="eyebrow">Remarks</p><h3>Maneuvers, observations, events, and lightkeeping</h3></div><ol>{activeSheet.remarks.map((remark, index) => <li key={`${remark}-${index}`}>{remark}</li>)}</ol></article><article className="summary-card"><div><p className="eyebrow">Tour summary</p><h3>Törnzusammenfassung</h3></div><dl><div><dt>Area</dt><dd>{activeSheet.daySummary.area || "—"}</dd></div><div><dt>Night hours</dt><dd>{activeSheet.daySummary.nightHours}</dd></div><div><dt>Days on board</dt><dd>{activeSheet.daySummary.daysOnBoard}</dd></div><div><dt>Sailing miles</dt><dd>{activeSheet.daySummary.sailingMiles} nm</dd></div><div><dt>Motor miles</dt><dd>{activeSheet.daySummary.motorMiles} nm</dd></div><div><dt>Outside FB2</dt><dd>{activeSheet.daySummary.outsideFb2Miles} nm</dd></div><div><dt>Engine hours</dt><dd>{activeSheet.daySummary.engineHoursStart} → {activeSheet.daySummary.engineHoursEnd}</dd></div></dl></article></div>
          <div className="bottom-grid"><article className="info-card"><h3>Crew for this sheet</h3><ul className="stack-list">{activeSheet.crew.map((person) => <li key={person.name}><strong>{person.name}</strong><span>{person.nationality} · {person.role}</span><small>{person.embarkation} → {person.disembarkation}</small></li>)}</ul></article><article className="info-card"><h3>Watch & daily checks</h3><ul className="check-list">{[...activeSheet.watchPlan, ...activeSheet.technicalChecks].map((item) => <li key={item}>{item}</li>)}</ul></article></div>
          <article className="compliance-card"><div><p className="eyebrow">Swiss compliance checklist</p><h3>Built from Hochseeausweis logbook requirements</h3></div><ul>{legalRequirements.map((requirement) => <li key={requirement}>{requirement}</li>)}</ul></article>
          <article className="signature-card"><div><span>Logbook lead</span><strong>{activeSheet.skipper.name}</strong></div><div><span>Skipper</span><strong>{activeSheet.skipper.name}</strong></div><div><span>Digital personal-log status</span><strong>{activeSheet.status}</strong></div></article>
        </section>}

        {activeModule === "boats" && <section className="sheet-detail module-panel"><ManagerShell title="Boats" split={boatSplit} newLabel="New boat" onNew={() => { setEditingBoatId(null); setBoatForm(defaultBoatForm); setShowBoatManager(true); }} onToggleSplit={() => setBoatSplit((split) => split === "vertical" ? "horizontal" : "vertical")} list={<ul className="manager-list">{logbook.boats.map((boat) => <li key={boat.id}><button type="button" className={boat.id === selectedBoat.id ? "active" : ""} onClick={() => { setSelectedBoatId(boat.id); setEditingBoatId(boat.id); setBoatForm(boatToForm(boat)); setShowBoatManager(false); pushAppPath(modulePath("boats", boat.id)); }}><span className="picture-thumb" aria-hidden="true" /><span><strong>{boat.name}</strong><small>{boat.type} · {boat.registration || "No registration"}</small></span></button></li>)}</ul>} form={<form className="inline-edit-grid" onSubmit={saveBoat}><p className="eyebrow">{showBoatManager ? "New boat" : "Boat form"}</p><label>Name<input required value={boatForm.name} onChange={(e) => setBoatForm({ ...boatForm, name: e.target.value })} /></label><label>Type<select value={boatForm.type} onChange={(e) => setBoatForm({ ...boatForm, type: e.target.value as BoatType })}><option>Sail</option><option>Motor</option></select></label><label>Registration<input value={boatForm.registration} onChange={(e) => setBoatForm({ ...boatForm, registration: e.target.value })} /></label><label>Flag state<input value={boatForm.flagState} onChange={(e) => setBoatForm({ ...boatForm, flagState: e.target.value })} /></label><label>Home port<input value={boatForm.homePort} onChange={(e) => setBoatForm({ ...boatForm, homePort: e.target.value })} /></label><label>Owner<input value={boatForm.owner} onChange={(e) => setBoatForm({ ...boatForm, owner: e.target.value })} /></label><label>Dimensions<input value={boatForm.dimensions} onChange={(e) => setBoatForm({ ...boatForm, dimensions: e.target.value })} /></label><label>Manufacturer<input value={boatForm.manufacturer} onChange={(e) => setBoatForm({ ...boatForm, manufacturer: e.target.value })} /></label><label>MMSI<input value={boatForm.mmsi} onChange={(e) => setBoatForm({ ...boatForm, mmsi: e.target.value })} /></label><label>Engine<input value={boatForm.engine} onChange={(e) => setBoatForm({ ...boatForm, engine: e.target.value })} /></label><label className="wide-field">Safety<textarea value={boatForm.safety} onChange={(e) => setBoatForm({ ...boatForm, safety: e.target.value })} /></label><div className="wide-field deviation-table-field"><div><p className="eyebrow">Deviation table</p><p>Compass headings from 0° to 350° in 10° steps. Enter deviation values such as +2° or -1°.</p></div><div className="table-scroll"><table className="deviation-table"><thead><tr><th>Heading</th><th>Deviation</th></tr></thead><tbody>{boatForm.deviationTable.map((row, index) => <tr key={row.heading}><td>{row.heading}°</td><td><input aria-label={`Deviation for ${row.heading} degrees`} value={row.deviation} onChange={(e) => setBoatForm({ ...boatForm, deviationTable: boatForm.deviationTable.map((candidate, candidateIndex) => candidateIndex === index ? { ...candidate, deviation: e.target.value } : candidate) })} /></td></tr>)}</tbody></table></div></div><div className="inline-edit-actions"><button type="submit">{showBoatManager ? "Create boat" : "Save boat"}</button><button type="button" className="ghost-button" onClick={cancelBoatEdit}>Cancel</button></div></form>} /></section>}

        {activeModule === "crew" && <section className="sheet-detail module-panel"><ManagerShell title="Crew" split={crewSplit} newLabel="New crew" onNew={() => { setLastCrewIndex(selectedCrewIndex >= 0 ? selectedCrewIndex : lastCrewIndex); setSelectedCrewIndex(-1); setCrewForm(defaultCrewForm); }} onToggleSplit={() => setCrewSplit((split) => split === "vertical" ? "horizontal" : "vertical")} list={<ul className="manager-list">{activeSheet.crew.map((person, index) => <li key={person.name}><button type="button" className={index === selectedCrewIndex ? "active" : ""} onClick={() => { selectCrew(index); pushAppPath(modulePath("crew", index)); }}><span className="picture-thumb" aria-hidden="true" /><span><strong>{person.name}</strong><small>{person.role}</small></span></button></li>)}</ul>} form={<form className="inline-edit-grid" onSubmit={async (event) => { event.preventDefault(); await saveCrew(); }}><p className="eyebrow">{selectedCrewIndex < 0 ? "New crew" : "Crew form"}</p><label>Name<input value={crewForm.name} onChange={(e) => setCrewForm({ ...crewForm, name: e.target.value })} /></label><label>Nationality<input value={crewForm.nationality} onChange={(e) => setCrewForm({ ...crewForm, nationality: e.target.value })} /></label><label>Role<input value={crewForm.role} onChange={(e) => setCrewForm({ ...crewForm, role: e.target.value })} /></label><label>Embarkation<input value={crewForm.embarkation} onChange={(e) => setCrewForm({ ...crewForm, embarkation: e.target.value })} /></label><label>Disembarkation<input value={crewForm.disembarkation} onChange={(e) => setCrewForm({ ...crewForm, disembarkation: e.target.value })} /></label><div className="inline-edit-actions"><button type="submit">Save crew</button><button type="button" className="ghost-button" onClick={cancelCrewEdit}>Cancel</button></div></form>} /></section>}



        {activeModule === "profile" && <section className="profile-page module-panel" aria-label="Profile page">
          <div className="page-heading"><div><h1>Profile</h1><p>Personal settings and account details — mocked for now.</p></div><button className="secondary-action" type="button" onClick={logout}>{isLoggingOut ? "Saving…" : "Logout"}</button></div>
          <section className="profile-grid">
            <article className="profile-hero-card"><span className="profile-avatar">JD</span><div><p className="eyebrow">Skipper profile</p><h2>Jane Doe</h2><p>{userEmail ?? "jane@example.com"}</p></div></article>
            <article className="info-card"><h3>Preferences</h3><dl><div><dt>Theme</dt><dd>{theme === "dark" ? "Dark mode" : "Light mode"}</dd></div><div><dt>Distance units</dt><dd>Nautical miles</dd></div><div><dt>Default vessel</dt><dd>{activeBoat.name}</dd></div></dl></article>
            <article className="info-card"><h3>Profile completion</h3><ul className="check-list"><li>Account created</li><li>Cloud sync connected</li><li>Skipper certificate pending</li><li>Emergency contact pending</li></ul></article>
          </section>
        </section>}

        {activeModule === "compliance" && <section className="sheet-detail module-panel"><div className="page-heading"><div><h1>Compliance</h1><p>ICC / Hochseeausweis requirements</p></div><button className="secondary-action" type="button">Download report</button></div><article className="compliance-board"><section className="compliance-summary"><h3>Overall progress</h3><div className="progress-layout"><div className="progress-ring"><strong>72%</strong><span>Complete</span></div><dl><div><dt>You have</dt><dd>2,173 nm</dd></div><div><dt>Required</dt><dd>3,000 nm</dd></div><div><dt>Remaining</dt><dd>827 nm</dd></div></dl></div></section><section className="requirement-panel"><h3>Requirement checklist</h3>{legalRequirements.map((requirement, index) => <div className="requirement-row" key={requirement}><span>✓</span><strong>{requirement}</strong><progress value={[2173,1650,1020,1250,1120,860][index] ?? 860} max={[3000,1500,1000,1000,1400,500][index] ?? 500} /></div>)}</section></article><div className="mileage-breakdown"><article><span>△</span><strong>Sail miles</strong><b>1,650 nm</b><small>70%</small></article><article><span>✚</span><strong>Motor miles</strong><b>523 nm</b><small>24%</small></article><article><span>⛵</span><strong>Ocean passages</strong><b>1,120 nm</b><small>30%</small></article><article><span>♙</span><strong>As skipper</strong><b>860 nm</b><small>40%</small></article></div></section>}
      </section>
      </section>
    </main>
  );
}

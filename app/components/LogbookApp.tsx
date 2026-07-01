"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { normalizeDeviationTable, type Boat, type BoatType, type BoatForm, type CrewForm, type LineForm, type LogLine, type LogSheet, type PersistedLogbook, type SheetForm } from "../models/logbook";
import { boatToForm, crewToForm, defaultBoatForm, defaultCrewForm, defaultLineForm, defaultLogbook, defaultSheetForm, lineToForm, seedBoats, seedSheets, sheetToForm } from "./logbook/forms";
import { createId, modulePath, normalizeLogbookIds, numberOrZero, persistLogbook, routeFromPathname } from "./logbook/persistence";
import { ManagerShell } from "./managers/ManagerShell";
import { courseConversionColumns } from "../domain/nautical/course-conversion";
import { ModuleTabs, type ActiveView } from "../templates/ModuleTabs";
import { DashboardPanel } from "../templates/DashboardPanel";
import { PasswordField } from "./PasswordField";
import { legalRequirements } from "../templates/compliance";

type AdminUser = { id: string; name: string; email: string; groups: string[] };

function parseLogTimeMinutes(time: string) {
  const match = time.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return undefined;
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return undefined;
  return hours * 60 + minutes;
}

function formatDuration(minutes: number) {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;
  return `${hours}h ${remainingMinutes.toString().padStart(2, "0")}m`;
}

function logLineDistanceDeltas(lines: LogLine[]) {
  return lines.map((line, index) => Math.max(0, line.logNm - (lines[index - 1]?.logNm ?? 0)));
}

function calculateSheetSummary(sheet: LogSheet) {
  const deltas = logLineDistanceDeltas(sheet.lines);
  const motorMiles = deltas.reduce((sum, delta, index) => sum + (sheet.lines[index]?.engine.trim() ? delta : 0), 0);
  const totalMiles = deltas.reduce((sum, delta) => sum + delta, 0);
  const sailMiles = Math.max(0, totalMiles - motorMiles);
  const firstTime = parseLogTimeMinutes(sheet.lines[0]?.time ?? "");
  const lastTime = parseLogTimeMinutes(sheet.lines.at(-1)?.time ?? "");
  const durationMinutes = firstTime === undefined || lastTime === undefined ? undefined : lastTime >= firstTime ? lastTime - firstTime : lastTime + 24 * 60 - firstTime;

  return { motorMiles, sailMiles, totalMiles, duration: durationMinutes === undefined ? "—" : formatDuration(durationMinutes) };
}

export function LogbookApp({ userId, userEmail, userName, userGroups = [] }: { userId?: string; userEmail?: string; userName?: string; userGroups?: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [logbook, setLogbook] = useState<PersistedLogbook>(defaultLogbook);
  const [activeSheetId, setActiveSheetId] = useState(defaultLogbook.sheets[0].id);
  const [isBackendReady, setIsBackendReady] = useState(false);
  const [routePath, setRoutePath] = useState(pathname);
  const [activeModule, setActiveModule] = useState<ActiveView>("dashboard");
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
  const [accountName, setAccountName] = useState(userName ?? "");
  const [accountEmail, setAccountEmail] = useState(userEmail ?? "");
  const [nameForm, setNameForm] = useState({ name: userName ?? "", currentPassword: "" });
  const [emailForm, setEmailForm] = useState({ email: userEmail ?? "", currentPassword: "" });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [deleteForm, setDeleteForm] = useState({ currentPassword: "", confirmation: "" });
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [knownGroups, setKnownGroups] = useState<string[]>(userGroups);
  const [adminMessage, setAdminMessage] = useState<string | null>(null);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [groupDrafts, setGroupDrafts] = useState<Record<string, string>>({});
  const logbookRef = useRef(logbook);

  function pushAppPath(path: string) {
    if (path === routePath) return;
    window.history.pushState(null, "", path);
    setRoutePath(path);
  }

  function navigate(module: ActiveView, itemId?: string | number) {
    if (module === "admin" && !userGroups.includes("admin")) return;
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
        if (Number.isInteger(crewIndex) && crewIndex >= 0 && crewIndex < normalizedLogbook.crewMembers.length) {
          setSelectedCrewIndex(crewIndex);
          setLastCrewIndex(crewIndex);
          setCrewForm(crewToForm(normalizedLogbook.crewMembers[crewIndex] ?? defaultCrewForm));
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
      const index = Number.parseInt(itemId, 10);
      if (Number.isInteger(index) && index >= 0 && index < logbook.crewMembers.length) {
        setSelectedCrewIndex(index);
        setLastCrewIndex(index);
        setCrewForm(crewToForm(logbook.crewMembers[index] ?? defaultCrewForm));
      }
    }
  }, [routePath, logbook, activeSheetId]);

  useEffect(() => {
    if (activeModule === "admin" && userGroups.includes("admin") && adminUsers.length === 0) loadAdminUsers().catch(() => undefined);
  }, [activeModule, userGroups, adminUsers.length]);

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
  const selectedCrew = logbook.crewMembers[selectedCrewIndex] ?? logbook.crewMembers[0];
  const isAdmin = userGroups.includes("admin");
  const isActiveSheetLocked = activeSheet.status === "Locked";
  const activeSheetSummary = useMemo(() => calculateSheetSummary(activeSheet), [activeSheet]);
  const crewAssignments = useMemo(() => logbook.crewMembers.map((member) => ({
    member,
    sheets: logbook.sheets.flatMap((sheet) => sheet.crew.findIndex((crew) => crew.id === member.id) >= 0 ? [{ sheet, isSkipper: sheet.crew.findIndex((crew) => crew.id === member.id) === 0 }] : []),
  })), [logbook]);

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

  function routeStamp(date: string, time: string) {
    return time ? `${date}, ${time}` : `${date}, time open`;
  }

  async function saveSheet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const currentLogbook = logbookRef.current;
    const existingSheet = editingSheetId ? currentLogbook.sheets.find((sheet) => sheet.id === editingSheetId) : undefined;
    const base = existingSheet ?? seedSheets[0];
    const id = editingSheetId ?? createId();
    const route = {
      from: sheetForm.from,
      to: sheetForm.to,
      departed: routeStamp(sheetForm.dateRange, sheetForm.fromTime),
      arrived: routeStamp(sheetForm.dateRange, sheetForm.toTime),
    };
    const currentUserCrew = currentLogbook.crewMembers.find((crew) => crew.isPrimary) ?? currentLogbook.crewMembers.find((crew) => crew.id === "me") ?? { id: "me", name: accountName || userName || "Current user", nationality: "", role: "Owner", address: "", certificate: "", isPrimary: true };
    const crewMembers = currentLogbook.crewMembers.some((crew) => crew.id === currentUserCrew.id) ? currentLogbook.crewMembers : [currentUserCrew, ...currentLogbook.crewMembers];
    const initialCrew = [{ ...currentUserCrew, embarkation: route.departed, disembarkation: route.arrived }];
    const sheet: LogSheet = {
      ...base,
      id,
      title: sheetForm.title || "Untitled sheet",
      dateRange: sheetForm.dateRange,
      status: sheetForm.status,
      boatId: sheetForm.boatId,
      route,
      crew: existingSheet?.crew ?? initialCrew,
      watchPlan: existingSheet?.watchPlan ?? [],
      technicalChecks: existingSheet?.technicalChecks ?? [],
      lines: existingSheet?.lines ?? [],
    };
    const nextLogbook = { ...currentLogbook, crewMembers, sheets: editingSheetId ? currentLogbook.sheets.map((candidate) => candidate.id === editingSheetId ? sheet : candidate) : [sheet, ...currentLogbook.sheets] };
    if (!await saveLogbookNow(nextLogbook)) return;
    setActiveSheetId(id);
    setEditingSheetId(null);
    setSheetForm(sheetToForm(sheet));
    setShowNewSheet(false);
    pushAppPath(modulePath("details", id));
  }

  async function deleteSelectedBoat() {
    if (!selectedBoat || logbookRef.current.sheets.some((sheet) => sheet.boatId === selectedBoat.id)) return;
    const nextBoats = logbookRef.current.boats.filter((boat) => boat.id !== selectedBoat.id);
    if (!await saveLogbookNow({ ...logbookRef.current, boats: nextBoats })) return;
    setSelectedBoatId(nextBoats[0]?.id ?? "");
    setEditingBoatId(nextBoats[0]?.id ?? null);
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
    if (sheet.status === "Locked") return;
    setActiveSheetId(sheet.id);
    setShowNewSheet(false);
    setEditingSheetId(sheet.id);
    setSheetForm(sheetToForm(sheet));
  }

  async function updateActiveSheetStatus(status: LogSheet["status"]) {
    const nextLogbook = { ...logbookRef.current, sheets: logbookRef.current.sheets.map((sheet) => sheet.id === activeSheet.id ? { ...sheet, status } : sheet) };
    await saveLogbookNow(nextLogbook);
  }

  function cancelSheetEdit() {
    setEditingSheetId(null);
    setSheetForm(defaultSheetForm(logbook.boats[0]?.id ?? seedBoats[0].id));
    setShowNewSheet(false);
  }

  async function saveLineFromFields() {
    if (activeSheet.status === "Locked") return;
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
      return { ...sheet, lines };
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
    if (activeSheet.status === "Locked") return;
    setEditingLineIndex(index);
    setLineForm(lineToForm(line));
    setShowAddLine(false);
  }

  function startAddingLine() {
    if (activeSheet.status === "Locked") return;
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
    const id = selectedCrewIndex < 0 ? createId() : crewForm.id;
    const crew = { id, name: crewForm.name, nationality: crewForm.nationality, role: crewForm.role, address: crewForm.address, certificate: crewForm.certificate, isPrimary: crewForm.isPrimary };
    const currentLogbook = logbookRef.current;
    const nextLogbook = { ...currentLogbook, crewMembers: selectedCrewIndex < 0 ? [...currentLogbook.crewMembers, crew] : currentLogbook.crewMembers.map((candidate) => candidate.id === id ? crew : candidate) };
    if (!await saveLogbookNow(nextLogbook)) return;
    if (selectedCrewIndex < 0) setSelectedCrewIndex(nextLogbook.crewMembers.length - 1);
  }

  async function addCrewToActiveSheet(crewId: string) {
    if (activeSheet.status === "Locked") return;
    const member = logbookRef.current.crewMembers.find((crew) => crew.id === crewId);
    if (!member) return;
    const nextLogbook = { ...logbookRef.current, sheets: logbookRef.current.sheets.map((sheet) => sheet.id === activeSheet.id && !sheet.crew.some((crew) => crew.id === crewId) ? { ...sheet, crew: [...sheet.crew, { ...member, embarkation: sheet.route.departed, disembarkation: sheet.route.arrived }] } : sheet) };
    await saveLogbookNow(nextLogbook);
  }

  async function updateCrewAssignment(index: number, field: "embarkation" | "disembarkation", value: string) {
    if (activeSheet.status === "Locked") return;
    const nextLogbook = { ...logbookRef.current, sheets: logbookRef.current.sheets.map((sheet) => {
      if (sheet.id !== activeSheet.id) return sheet;
      return { ...sheet, crew: sheet.crew.map((crew, crewIndex) => crewIndex === index ? { ...crew, [field]: value } : crew) };
    }) };
    await saveLogbookNow(nextLogbook);
  }

  async function moveCrewOnActiveSheet(index: number, direction: -1 | 1) {
    if (activeSheet.status === "Locked") return;
    const nextLogbook = { ...logbookRef.current, sheets: logbookRef.current.sheets.map((sheet) => {
      if (sheet.id !== activeSheet.id) return sheet;
      const crew = [...sheet.crew];
      const target = index + direction;
      if (target < 0 || target >= crew.length) return sheet;
      [crew[index], crew[target]] = [crew[target], crew[index]];
      return { ...sheet, crew };
    }) };
    await saveLogbookNow(nextLogbook);
  }

  async function deleteCrewFromActiveSheet(index: number) {
    if (activeSheet.status === "Locked") return;
    const nextLogbook = { ...logbookRef.current, sheets: logbookRef.current.sheets.map((sheet) => {
      if (sheet.id !== activeSheet.id) return sheet;
      return { ...sheet, crew: sheet.crew.filter((_, crewIndex) => crewIndex !== index) };
    }) };
    await saveLogbookNow(nextLogbook);
  }

  async function deleteSelectedCrew() {
    if (!selectedCrew || selectedCrew.isPrimary || selectedCrew.id === "me" || crewAssignments.find((entry) => entry.member.id === selectedCrew.id)?.sheets.length) return;
    const nextCrewMembers = logbookRef.current.crewMembers.filter((crew) => crew.id !== selectedCrew.id);
    if (!await saveLogbookNow({ ...logbookRef.current, crewMembers: nextCrewMembers })) return;
    setSelectedCrewIndex(0);
  }

  function selectCrew(index: number) {
    setSelectedCrewIndex(index);
    setLastCrewIndex(index);
    setCrewForm(crewToForm(logbook.crewMembers[index] ?? defaultCrewForm));
  }

  function cancelCrewEdit() {
    const nextIndex = Math.min(lastCrewIndex, Math.max(logbook.crewMembers.length - 1, 0));
    setSelectedCrewIndex(nextIndex);
    setCrewForm(crewToForm(logbook.crewMembers[nextIndex] ?? defaultCrewForm));
  }

  async function updateName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileError(null);
    setProfileMessage(null);
    const response = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "name", ...nameForm }) });
    const payload = await response.json().catch(() => ({})) as { name?: string; error?: string };
    if (!response.ok) {
      setProfileError(payload.error ?? "Unable to update name.");
      return;
    }
    setAccountName(payload.name ?? nameForm.name);
    setNameForm({ name: payload.name ?? nameForm.name, currentPassword: "" });
    setProfileMessage("Username updated.");
  }

  async function updateEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileError(null);
    setProfileMessage(null);
    const response = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "email", ...emailForm }) });
    const payload = await response.json().catch(() => ({})) as { email?: string; error?: string };
    if (!response.ok) {
      setProfileError(payload.error ?? "Unable to update email.");
      return;
    }
    setAccountEmail(payload.email ?? emailForm.email);
    setEmailForm({ email: payload.email ?? emailForm.email, currentPassword: "" });
    setProfileMessage("Email updated. Use the new email next time you log in.");
  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileError(null);
    setProfileMessage(null);
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setProfileError("New passwords do not match.");
      return;
    }
    const response = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "password", currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword }) });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) {
      setProfileError(payload.error ?? "Unable to update password.");
      return;
    }
    setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    setProfileMessage("Password updated.");
  }


  async function loadAdminUsers() {
    setAdminError(null);
    const response = await fetch("/api/admin/users");
    const payload = await response.json().catch(() => ({})) as { users?: AdminUser[]; groups?: string[]; error?: string };
    if (!response.ok) {
      setAdminError(payload.error ?? "Unable to load users.");
      return;
    }
    setAdminUsers(payload.users ?? []);
    setKnownGroups(payload.groups ?? []);
  }


  function addAdminUserGroup(userId: string) {
    const draft = groupDrafts[userId]?.trim();
    if (!draft) return;
    const group = draft.toLowerCase().replace(/\s+/g, "-");
    setAdminUsers((users) => users.map((user) => user.id === userId && !user.groups.includes(group) ? { ...user, groups: [...user.groups, group].sort((a, b) => a.localeCompare(b)) } : user));
    setGroupDrafts((drafts) => ({ ...drafts, [userId]: "" }));
  }

  function canRemoveAdminUserGroup(targetUserId: string, group: string) {
    return !(targetUserId === userId && group === "admin");
  }

  function removeAdminUserGroup(targetUserId: string, group: string) {
    if (!canRemoveAdminUserGroup(targetUserId, group)) return;
    setAdminUsers((users) => users.map((user) => user.id === targetUserId ? { ...user, groups: user.groups.filter((candidate) => candidate !== group) } : user));
  }

  function handleGroupDraftKeyDown(event: React.KeyboardEvent<HTMLInputElement>, userId: string) {
    if (event.key !== "Enter" && event.key !== ",") return;
    event.preventDefault();
    addAdminUserGroup(userId);
  }

  async function saveAdminUserGroups(userId: string, groupsText: string) {
    setAdminError(null);
    setAdminMessage(null);
    const groups = groupsText.split(",").map((group) => group.trim()).filter(Boolean);
    const response = await fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, groups }) });
    const payload = await response.json().catch(() => ({})) as { user?: AdminUser; groups?: string[]; error?: string };
    if (!response.ok) {
      setAdminError(payload.error ?? "Unable to save groups.");
      return;
    }
    if (payload.user) setAdminUsers((users) => users.map((user) => user.id === payload.user?.id ? payload.user : user));
    setKnownGroups(payload.groups ?? groups);
    setAdminMessage("Groups saved.");
  }

  async function deleteAdminUser(targetUser: AdminUser) {
    setAdminError(null);
    setAdminMessage(null);
    const confirmationName = window.prompt(`Type ${targetUser.name} to permanently delete this user account.`);
    if (confirmationName === null) return;
    if (confirmationName !== targetUser.name) {
      setAdminError("Type the username to confirm account deletion.");
      return;
    }
    const response = await fetch("/api/admin/users", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: targetUser.id, confirmationName }) });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) {
      setAdminError(payload.error ?? "Unable to delete user.");
      return;
    }
    setAdminUsers((users) => users.filter((user) => user.id !== targetUser.id));
    setAdminMessage(`Deleted user ${targetUser.name}.`);
  }

  async function deleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileError(null);
    setProfileMessage(null);
    if (deleteForm.confirmation !== "DELETE") {
      setProfileError('Type "DELETE" to confirm account deletion.');
      return;
    }
    const response = await fetch("/api/profile", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword: deleteForm.currentPassword }) });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) {
      setProfileError(payload.error ?? "Unable to delete account.");
      return;
    }
    await signOut({ redirect: false });
    router.push("/register");
    router.refresh();
  }

  return (
    <main className="app-shell" data-theme={theme} data-nav={isNavSlim ? "slim" : "full"}>
      {profileMessage && <div className="toast-notification" role="status" aria-live="polite">{profileMessage}</div>}
      <ModuleTabs activeModule={activeModule} onSelectModule={(module) => navigate(module)} onOpenProfile={() => navigate("profile")} theme={theme} onToggleTheme={() => setTheme((current) => current === "dark" ? "light" : "dark")} userEmail={accountEmail || userEmail} userName={accountName || userName} userGroups={userGroups} isNavSlim={isNavSlim} onToggleNavSlim={() => setIsNavSlim((current) => !current)} onLogout={logout} isLoggingOut={isLoggingOut} />
      <section className="app-content">
      {saveError && <p className="save-error">{saveError}</p>}

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
              const sheetSummary = calculateSheetSummary(sheet);
              const motorMiles = sheetSummary.motorMiles;
              const sailMiles = sheetSummary.sailMiles;
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
                <label>Name<input required value={sheetForm.title} onChange={(e) => setSheetForm({ ...sheetForm, title: e.target.value })} /></label>
                <label>Boat<select value={sheetForm.boatId} onChange={(e) => setSheetForm({ ...sheetForm, boatId: e.target.value })}>{logbook.boats.map((boat) => <option key={boat.id} value={boat.id}>{boat.name}</option>)}</select></label>
                {editingSheetId && <button type="button" className="edit-chip" onClick={() => { setSelectedBoatId(sheetForm.boatId); setEditingBoatId(sheetForm.boatId); const boat = logbook.boats.find((candidate) => candidate.id === sheetForm.boatId); if (boat) setBoatForm(boatToForm(boat)); setShowBoatManager(false); navigate("boats", sheetForm.boatId); }}>Jump to boat</button>}
                <label>From date<input type="date" value={sheetForm.dateRange} onChange={(e) => setSheetForm({ ...sheetForm, dateRange: e.target.value })} /></label>
                <label>From position<input value={sheetForm.from} onChange={(e) => setSheetForm({ ...sheetForm, from: e.target.value })} /></label>
                <label>To date<input type="date" value={sheetForm.dateRange} onChange={(e) => setSheetForm({ ...sheetForm, dateRange: e.target.value })} /></label>
                <label>To position<input value={sheetForm.to} onChange={(e) => setSheetForm({ ...sheetForm, to: e.target.value })} /></label>
                <label>Departure time<input type="time" value={sheetForm.fromTime} onChange={(e) => setSheetForm({ ...sheetForm, fromTime: e.target.value })} /></label>
                <label>Arrival time<input type="time" value={sheetForm.toTime} onChange={(e) => setSheetForm({ ...sheetForm, toTime: e.target.value })} /></label>
              </div>
              <div className="inline-edit-actions"><button type="submit">Save</button>{showNewSheet ? <button type="button" className="ghost-button" onClick={() => { cancelSheetEdit(); navigate("logbooks"); }}>Cancel</button> : <button type="button" className="ghost-button" onClick={() => setSheetForm(sheetToForm(activeSheet))}>Discard changes</button>}</div>
            </form>
          ) : (
            <>
              <section className="sheet-title-row logbook-section" aria-label="Logbook sheet header"><div><p className="eyebrow">Header</p><h2 id="sheet-title">{activeSheet.title}</h2><p>{activeSheet.route.from} → {activeSheet.route.to} · {activeSheet.dateRange}</p></div><div className="inline-edit-actions"><span className="status-pill">{activeSheet.status}</span>{isActiveSheetLocked ? <button type="button" className="edit-chip" onClick={() => updateActiveSheetStatus("Draft")}>Unlock sheet</button> : <><button type="button" className="edit-chip" onClick={() => startEditingSheet(activeSheet)}>Edit sheet</button><button type="button" className="edit-chip" onClick={() => updateActiveSheetStatus("Locked")}>Lock sheet</button></>}</div><dl className="paper-header header-details"><div><dt>Name</dt><dd>{activeSheet.title}</dd></div><div><dt>Boat</dt><dd>{activeBoat.name} <button type="button" className="edit-chip" onClick={() => { setSelectedBoatId(activeBoat.id); setEditingBoatId(activeBoat.id); setBoatForm(boatToForm(activeBoat)); setShowBoatManager(false); navigate("boats", activeBoat.id); }}>Jump to boat</button></dd></div><div><dt>From date</dt><dd>{activeSheet.route.departed || activeSheet.dateRange}</dd></div><div><dt>From position</dt><dd>{activeSheet.route.from || "—"}</dd></div><div><dt>To date</dt><dd>{activeSheet.route.arrived || activeSheet.dateRange}</dd></div><div><dt>To position</dt><dd>{activeSheet.route.to || "—"}</dd></div></dl></section>
            </>
          )}

          {!showNewSheet && <>
          <section className="entry-metrics logbook-section" aria-label="Summary calculated from log lines"><article><span>Motor miles</span><strong>{activeSheetSummary.motorMiles} nm</strong></article><article><span>Sail miles</span><strong>{activeSheetSummary.sailMiles} nm</strong></article><article><span>Total miles</span><strong>{activeSheetSummary.totalMiles} nm</strong></article><article><span>Duration</span><strong>{activeSheetSummary.duration}</strong></article></section>


          <article className="table-card"><div className="table-header"><div><p className="eyebrow">Combined day sheet</p><h3>Meteorological and nautical log lines</h3></div><div className="table-actions"><button type="button" onClick={() => setShowCourseColumns((show) => !show)}>{showCourseColumns ? "Hide" : "Show"} course conversion columns</button><button type="button" disabled={isActiveSheetLocked} onClick={startAddingLine}>+ Add line</button></div></div><div className="table-scroll"><table className={showCourseColumns ? "with-course-columns" : undefined}><thead><tr><th>Time</th><th>Weather</th><th>Baro</th><th>Sea</th><th>Wind</th><th>MgK / CC</th>{showCourseColumns && courseConversionColumns.map((column) => <th key={column}>{column}</th>)}<th>KüG / COG</th><th>Log</th><th>Sail</th><th>Motor</th><th>Position</th><th>Lat / Lon</th><th>Remarks</th><th>Actions</th></tr></thead><tbody>{showAddLine && <tr className="inline-line-row"><td><input value={lineForm.time} onChange={(e) => setLineForm({ ...lineForm, time: e.target.value })} /></td><td><input value={lineForm.weather} onChange={(e) => setLineForm({ ...lineForm, weather: e.target.value })} /></td><td><input value={lineForm.barometer} onChange={(e) => setLineForm({ ...lineForm, barometer: e.target.value })} /></td><td><input value={lineForm.seaState} onChange={(e) => setLineForm({ ...lineForm, seaState: e.target.value })} /></td><td><input value={lineForm.wind} onChange={(e) => setLineForm({ ...lineForm, wind: e.target.value })} /></td><td><input value={lineForm.magneticCourse} onChange={(e) => setLineForm({ ...lineForm, magneticCourse: e.target.value })} /></td>{showCourseColumns && courseConversionColumns.map((column) => <td className="optional-course-cell" key={`new-${column}`}>—</td>)}<td><input value={lineForm.course} onChange={(e) => setLineForm({ ...lineForm, course: e.target.value })} /></td><td><input value={lineForm.logNm} onChange={(e) => setLineForm({ ...lineForm, logNm: e.target.value })} /></td><td><input value={lineForm.sails} onChange={(e) => setLineForm({ ...lineForm, sails: e.target.value })} /></td><td><input value={lineForm.engine} onChange={(e) => setLineForm({ ...lineForm, engine: e.target.value })} /></td><td><input value={lineForm.position} onChange={(e) => setLineForm({ ...lineForm, position: e.target.value })} /></td><td><div className="coordinate-inputs"><input aria-label="Latitude" value={lineForm.latitude} onChange={(e) => setLineForm({ ...lineForm, latitude: e.target.value })} /><input aria-label="Longitude" value={lineForm.longitude} onChange={(e) => setLineForm({ ...lineForm, longitude: e.target.value })} /></div></td><td><input value={lineForm.remarks} onChange={(e) => setLineForm({ ...lineForm, remarks: e.target.value })} /></td><td><div className="table-actions"><button type="button" onClick={saveLineFromFields}>{editingLineIndex === null ? "Save line" : "Update line"}</button><button type="button" className="ghost-button" onClick={cancelLineEdit}>Cancel</button></div></td></tr>}{activeSheet.lines.map((line, index) => editingLineIndex === index ? <tr key={`edit-${index}`} className="inline-line-row"><td><input value={lineForm.time} onChange={(e) => setLineForm({ ...lineForm, time: e.target.value })} /></td><td><input value={lineForm.weather} onChange={(e) => setLineForm({ ...lineForm, weather: e.target.value })} /></td><td><input value={lineForm.barometer} onChange={(e) => setLineForm({ ...lineForm, barometer: e.target.value })} /></td><td><input value={lineForm.seaState} onChange={(e) => setLineForm({ ...lineForm, seaState: e.target.value })} /></td><td><input value={lineForm.wind} onChange={(e) => setLineForm({ ...lineForm, wind: e.target.value })} /></td><td><input value={lineForm.magneticCourse} onChange={(e) => setLineForm({ ...lineForm, magneticCourse: e.target.value })} /></td>{showCourseColumns && courseConversionColumns.map((column) => <td className="optional-course-cell" key={`new-${column}`}>—</td>)}<td><input value={lineForm.course} onChange={(e) => setLineForm({ ...lineForm, course: e.target.value })} /></td><td><input value={lineForm.logNm} onChange={(e) => setLineForm({ ...lineForm, logNm: e.target.value })} /></td><td><input value={lineForm.sails} onChange={(e) => setLineForm({ ...lineForm, sails: e.target.value })} /></td><td><input value={lineForm.engine} onChange={(e) => setLineForm({ ...lineForm, engine: e.target.value })} /></td><td><input value={lineForm.position} onChange={(e) => setLineForm({ ...lineForm, position: e.target.value })} /></td><td><div className="coordinate-inputs"><input aria-label="Latitude" value={lineForm.latitude} onChange={(e) => setLineForm({ ...lineForm, latitude: e.target.value })} /><input aria-label="Longitude" value={lineForm.longitude} onChange={(e) => setLineForm({ ...lineForm, longitude: e.target.value })} /></div></td><td><input value={lineForm.remarks} onChange={(e) => setLineForm({ ...lineForm, remarks: e.target.value })} /></td><td><div className="table-actions"><button type="button" onClick={saveLineFromFields}>{editingLineIndex === null ? "Save line" : "Update line"}</button><button type="button" className="ghost-button" onClick={cancelLineEdit}>Cancel</button></div></td></tr> : <tr key={`${line.time}-${line.position}-${index}`}><td>{line.time}</td><td>{line.weather}</td><td>{line.barometer}</td><td>{line.seaState}</td><td>{line.wind}</td><td>{line.magneticCourse}</td>{showCourseColumns && courseConversionColumns.map((column) => <td className="optional-course-cell" key={`${line.time}-${index}-${column}`}>—</td>)}<td>{line.course}</td><td>{line.logNm} nm</td><td>{line.sails}</td><td>{line.engine}</td><td>{line.position}</td><td>{line.latitude.toFixed(3)} / {line.longitude.toFixed(3)}</td><td>{line.remarks}</td><td><button type="button" className="edit-chip" disabled={isActiveSheetLocked} onClick={() => startEditingLine(line, index)}>Edit</button></td></tr>)}</tbody></table></div></article>

          <section className="sheet-support-grid logbook-section" aria-label="Sheet support sections"><article className="info-card logbook-section"><h3>Crew list</h3><label>Add crew member<select disabled={isActiveSheetLocked} defaultValue="" onChange={(e) => { if (e.target.value) addCrewToActiveSheet(e.target.value); e.currentTarget.value = ""; }}><option value="">Select crew…</option>{logbook.crewMembers.filter((member) => !activeSheet.crew.some((crew) => crew.id === member.id)).map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label><ul className="stack-list">{activeSheet.crew.map((person, index) => <li key={`${person.id}-${index}`}><strong>{index + 1}. {index === 0 ? "⭐ Skipper · " : ""}{person.name}</strong><span>{person.nationality} · {person.role}</span><label>Embarkation<input disabled={isActiveSheetLocked} value={person.embarkation || activeSheet.route.departed} onChange={(e) => updateCrewAssignment(index, "embarkation", e.target.value)} /></label><label>Disembarkation<input disabled={isActiveSheetLocked} value={person.disembarkation || activeSheet.route.arrived} onChange={(e) => updateCrewAssignment(index, "disembarkation", e.target.value)} /></label><span><button type="button" className="edit-chip" disabled={isActiveSheetLocked || index === 0} onClick={() => moveCrewOnActiveSheet(index, -1)}>↑</button><button type="button" className="edit-chip" disabled={isActiveSheetLocked || index === activeSheet.crew.length - 1} onClick={() => moveCrewOnActiveSheet(index, 1)}>↓</button><button type="button" className="edit-chip" disabled={isActiveSheetLocked} onClick={() => deleteCrewFromActiveSheet(index)}>Delete</button></span></li>)}</ul></article><article className="info-card logbook-section"><h3>Technical log / daily checks</h3><ul className="check-list">{[...activeSheet.watchPlan, ...activeSheet.technicalChecks].map((item) => <li key={item}>{item}</li>)}</ul></article><article className="map-card logbook-section"><div><p className="eyebrow">Map</p><h3>Positions connected from log lines</h3></div><div className="route-map" aria-label="Stylized route map preview">{activeSheet.lines.map((line, index) => <span className="map-marker" key={`${line.time}-${line.position}-${index}`} style={{ left: `${12 + index * (76 / Math.max(activeSheet.lines.length - 1, 1))}%`, top: `${62 - index * 8}%` }} title={`${line.time} · ${line.position}`}>{index + 1}</span>)}</div></article></section>
          </>}
        </section>}

        {activeModule === "boats" && <section className="sheet-detail module-panel"><ManagerShell title="Boats" newLabel="New boat" onNew={() => { setEditingBoatId(null); setBoatForm(defaultBoatForm); setShowBoatManager(true); }} list={<ul className="manager-list">{logbook.boats.map((boat) => <li key={boat.id}><button type="button" className={boat.id === selectedBoat.id ? "active" : ""} onClick={() => { setSelectedBoatId(boat.id); setEditingBoatId(boat.id); setBoatForm(boatToForm(boat)); setShowBoatManager(false); pushAppPath(modulePath("boats", boat.id)); }}><span><strong>{boat.name}</strong><small>{boat.type} · {boat.registration || "No registration"}</small></span></button></li>)}</ul>} form={<form className="inline-edit-grid" onSubmit={saveBoat}><p className="eyebrow">{showBoatManager ? "New boat" : "Boat form"}</p><label>Name<input required value={boatForm.name} onChange={(e) => setBoatForm({ ...boatForm, name: e.target.value })} /></label><label>Type<select value={boatForm.type} onChange={(e) => setBoatForm({ ...boatForm, type: e.target.value as BoatType })}><option>Sail</option><option>Motor</option></select></label><label>Registration<input value={boatForm.registration} onChange={(e) => setBoatForm({ ...boatForm, registration: e.target.value })} /></label><label>Flag state<input value={boatForm.flagState} onChange={(e) => setBoatForm({ ...boatForm, flagState: e.target.value })} /></label><label>Home port<input value={boatForm.homePort} onChange={(e) => setBoatForm({ ...boatForm, homePort: e.target.value })} /></label><label>Owner<input value={boatForm.owner} onChange={(e) => setBoatForm({ ...boatForm, owner: e.target.value })} /></label><label>Dimensions<input value={boatForm.dimensions} onChange={(e) => setBoatForm({ ...boatForm, dimensions: e.target.value })} /></label><label>Manufacturer<input value={boatForm.manufacturer} onChange={(e) => setBoatForm({ ...boatForm, manufacturer: e.target.value })} /></label><label>MMSI<input value={boatForm.mmsi} onChange={(e) => setBoatForm({ ...boatForm, mmsi: e.target.value })} /></label><label>Engine<input value={boatForm.engine} onChange={(e) => setBoatForm({ ...boatForm, engine: e.target.value })} /></label><label className="wide-field">Safety<textarea value={boatForm.safety} onChange={(e) => setBoatForm({ ...boatForm, safety: e.target.value })} /></label><div className="wide-field deviation-table-field"><div><p className="eyebrow">Deviation table</p><p>Compass headings from 0° to 350° in 10° steps. Enter deviation values such as +2° or -1°.</p></div><div className="table-scroll"><table className="deviation-table"><thead><tr><th>Heading</th><th>Deviation</th></tr></thead><tbody>{boatForm.deviationTable.map((row, index) => <tr key={row.heading}><td>{row.heading}°</td><td><input aria-label={`Deviation for ${row.heading} degrees`} value={row.deviation} onChange={(e) => setBoatForm({ ...boatForm, deviationTable: boatForm.deviationTable.map((candidate, candidateIndex) => candidateIndex === index ? { ...candidate, deviation: e.target.value } : candidate) })} /></td></tr>)}</tbody></table></div></div><article className="info-card wide-field"><h3>Log sheets</h3><ul className="stack-list">{logbook.sheets.filter((sheet) => sheet.boatId === (editingBoatId ?? selectedBoat.id)).map((sheet) => <li key={sheet.id}><strong>{sheet.title}</strong><small>{sheet.dateRange}</small></li>)}</ul></article><div className="inline-edit-actions"><button type="submit">{showBoatManager ? "Create boat" : "Save boat"}</button><button type="button" className="ghost-button" onClick={cancelBoatEdit}>Cancel</button><button type="button" className="ghost-button" disabled={logbook.sheets.some((sheet) => sheet.boatId === selectedBoat.id)} onClick={deleteSelectedBoat}>Delete boat</button></div></form>} /></section>}

        {activeModule === "crew" && <section className="sheet-detail module-panel"><ManagerShell title="Crew" newLabel="New crew" onNew={() => { setLastCrewIndex(selectedCrewIndex >= 0 ? selectedCrewIndex : lastCrewIndex); setSelectedCrewIndex(-1); setCrewForm(defaultCrewForm); }} list={<ul className="manager-list">{logbook.crewMembers.map((person, index) => <li key={person.id}><button type="button" className={index === selectedCrewIndex ? "active" : ""} onClick={() => { selectCrew(index); pushAppPath(modulePath("crew", index)); }}><span><strong>{person.isPrimary ? "⭐ " : ""}{person.name}</strong><small>{person.role || "Crew member"}</small></span></button></li>)}</ul>} form={<form className="inline-edit-grid" onSubmit={async (event) => { event.preventDefault(); await saveCrew(); }}><p className="eyebrow">{selectedCrewIndex < 0 ? "New crew profile" : crewForm.isPrimary ? "This is me" : "Crew profile"}</p><label>Name<input value={crewForm.name} onChange={(e) => setCrewForm({ ...crewForm, name: e.target.value })} /></label><label>Nationality<input value={crewForm.nationality} onChange={(e) => setCrewForm({ ...crewForm, nationality: e.target.value })} /></label><label>Role<input value={crewForm.role} onChange={(e) => setCrewForm({ ...crewForm, role: e.target.value })} /></label><label>Address<input value={crewForm.address ?? ""} onChange={(e) => setCrewForm({ ...crewForm, address: e.target.value })} /></label><label className="wide-field">Skipper certificate<input value={crewForm.certificate ?? ""} onChange={(e) => setCrewForm({ ...crewForm, certificate: e.target.value })} /></label><article className="info-card wide-field"><h3>Log sheets</h3><ul className="stack-list">{(crewAssignments.find((entry) => entry.member.id === crewForm.id)?.sheets ?? []).map(({ sheet, isSkipper }) => <li key={sheet.id}><strong>{isSkipper ? "⭐ Skipper · " : "Crew · "}{sheet.title}</strong><small>{sheet.dateRange}</small></li>)}</ul></article><div className="inline-edit-actions"><button type="submit">Save crew</button><button type="button" className="ghost-button" onClick={cancelCrewEdit}>Cancel</button><button type="button" className="ghost-button" disabled={crewForm.isPrimary || crewForm.id === "me" || Boolean(crewAssignments.find((entry) => entry.member.id === crewForm.id)?.sheets.length)} onClick={deleteSelectedCrew}>Delete</button></div></form>} /></section>}



        {activeModule === "profile" && <section className="profile-page module-panel" aria-label="Profile page">
          <div className="page-heading"><div><h1>Profile</h1><p>Personal settings and account details.</p></div><button className="secondary-action" type="button" onClick={logout}>{isLoggingOut ? "Saving…" : "Logout"}</button></div>
          <section className="profile-grid">
            <article className="profile-hero-card"><span className="profile-avatar">ME</span><div><p className="eyebrow">User profile</p><h2>{accountName || logbook.crewMembers.find((crew) => crew.isPrimary)?.name || "My profile"}</h2><p>{accountEmail || "No email set"}</p><p className="group-tags">{userGroups.length ? userGroups.map((group) => <span key={group}>{group}</span>) : <span>No groups</span>}</p><button type="button" className="edit-chip" onClick={() => { const meIndex = logbook.crewMembers.findIndex((crew) => crew.isPrimary); if (meIndex >= 0) { selectCrew(meIndex); navigate("crew", meIndex); } }}>Show my crew member details</button></div></article>
            {(profileMessage || profileError) && <article className="info-card"><h3>Account status</h3>{profileMessage && <p className="save-success">{profileMessage}</p>}{profileError && <p className="save-error">{profileError}</p>}</article>}
            <form className="info-card inline-edit-grid" onSubmit={updateName}><h3>Change username</h3><label className="wide-field">New username<input required value={nameForm.name} onChange={(e) => setNameForm({ ...nameForm, name: e.target.value })} /></label><PasswordField className="wide-field" label="Current password" required value={nameForm.currentPassword} onChange={(e) => setNameForm({ ...nameForm, currentPassword: e.target.value })} /><div className="inline-edit-actions"><button type="submit">Update username</button></div><p className="wide-field">Usernames must be unique and may not contain reserved or abusive terms.</p></form>
            <form className="info-card inline-edit-grid" onSubmit={updateEmail}><h3>Change email</h3><label className="wide-field">New email<input type="email" required value={emailForm.email} onChange={(e) => setEmailForm({ ...emailForm, email: e.target.value })} /></label><PasswordField className="wide-field" label="Current password" required value={emailForm.currentPassword} onChange={(e) => setEmailForm({ ...emailForm, currentPassword: e.target.value })} /><div className="inline-edit-actions"><button type="submit">Update email</button></div></form>
            <form className="info-card inline-edit-grid" onSubmit={updatePassword}><h3>Change password</h3><PasswordField className="wide-field" label="Current password" required value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} /><PasswordField className="wide-field" label="New password" required minLength={8} value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} /><PasswordField className="wide-field" label="Confirm new password" required minLength={8} value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} /><div className="inline-edit-actions"><button type="submit">Update password</button></div></form>
            <article className="info-card"><h3>Preferences</h3><dl><div><dt>Theme</dt><dd>{theme === "dark" ? "Dark mode" : "Light mode"}</dd></div><div><dt>Distance units</dt><dd>Nautical miles</dd></div><div><dt>Default vessel</dt><dd>{activeBoat.name}</dd></div></dl></article>
            <form className="info-card inline-edit-grid" onSubmit={deleteAccount}><h3>Delete account</h3><p className="wide-field">This permanently deletes your account and all logbooks, boats, crew members, and log lines.</p><PasswordField className="wide-field" label="Current password" required value={deleteForm.currentPassword} onChange={(e) => setDeleteForm({ ...deleteForm, currentPassword: e.target.value })} /><label className="wide-field">Type DELETE to confirm<input required value={deleteForm.confirmation} onChange={(e) => setDeleteForm({ ...deleteForm, confirmation: e.target.value })} /></label><div className="inline-edit-actions"><button type="submit" className="ghost-button">Delete account</button></div></form>
          </section>
        </section>}



        {activeModule === "admin" && isAdmin && <section className="module-panel" aria-label="Admin page">
          <div className="page-heading"><div><h1>Admin</h1><p>Manage user groups for issues #45 and #46.</p></div><button className="secondary-action" type="button" onClick={loadAdminUsers}>Refresh users</button></div>
          {(adminMessage || adminError) && <article className="info-card">{adminMessage && <p className="save-success">{adminMessage}</p>}{adminError && <p className="save-error">{adminError}</p>}</article>}
          <article className="table-card">
            <div className="table-header"><div><p className="eyebrow">Tag-style groups</p><h3>Users</h3><p>Existing groups: {knownGroups.length ? knownGroups.join(", ") : "none yet"}</p></div></div>
            <div className="table-scroll"><table className="logbook-table"><thead><tr><th>Username</th><th>Email</th><th>Groups</th><th></th><th></th></tr></thead><tbody>{adminUsers.map((user) => <tr key={user.id}><td>{user.name}</td><td>{user.email}</td><td><div className="tag-editor" aria-label={`Groups for ${user.email}`}>{user.groups.length > 0 && <div className="tag-editor-tags">{user.groups.map((group) => <span key={group}>{group}<button type="button" aria-label={`Remove ${group} from ${user.email}`} disabled={!canRemoveAdminUserGroup(user.id, group)} title={!canRemoveAdminUserGroup(user.id, group) ? "You cannot remove admin from your own account." : undefined} onClick={() => removeAdminUserGroup(user.id, group)}>×</button></span>)}</div>}<div className="tag-editor-add"><input aria-label={`Add group for ${user.email}`} list="known-groups" placeholder="Select or type group…" value={groupDrafts[user.id] ?? ""} onChange={(event) => setGroupDrafts((drafts) => ({ ...drafts, [user.id]: event.target.value }))} onKeyDown={(event) => handleGroupDraftKeyDown(event, user.id)} /><button type="button" className="edit-chip" onClick={() => addAdminUserGroup(user.id)}>Add</button></div></div></td><td><button type="button" className="edit-chip" onClick={() => saveAdminUserGroups(user.id, user.groups.join(", "))}>Save</button></td><td><button type="button" className="ghost-button" disabled={user.id === userId} title={user.id === userId ? "Use your profile page to delete your own account." : undefined} onClick={() => deleteAdminUser(user)}>Delete</button></td></tr>)}</tbody></table></div>
            <datalist id="known-groups">{knownGroups.map((group) => <option key={group} value={group} />)}</datalist>
          </article>
        </section>}

        {activeModule === "compliance" && <section className="sheet-detail module-panel"><div className="page-heading"><div><h1>Compliance</h1><p>ICC / Hochseeausweis requirements</p></div><button className="secondary-action" type="button">Download report</button></div><article className="compliance-board"><section className="compliance-summary"><h3>Overall progress</h3><div className="progress-layout"><div className="progress-ring"><strong>72%</strong><span>Complete</span></div><dl><div><dt>You have</dt><dd>2,173 nm</dd></div><div><dt>Required</dt><dd>3,000 nm</dd></div><div><dt>Remaining</dt><dd>827 nm</dd></div></dl></div></section><section className="requirement-panel"><h3>Requirement checklist</h3>{legalRequirements.map((requirement, index) => <div className="requirement-row" key={requirement}><span>✓</span><strong>{requirement}</strong><progress value={[2173,1650,1020,1250,1120,860][index] ?? 860} max={[3000,1500,1000,1000,1400,500][index] ?? 500} /></div>)}</section></article><div className="mileage-breakdown"><article><span>△</span><strong>Sail miles</strong><b>1,650 nm</b><small>70%</small></article><article><span>✚</span><strong>Motor miles</strong><b>523 nm</b><small>24%</small></article><article><span>⛵</span><strong>Ocean passages</strong><b>1,120 nm</b><small>30%</small></article><article><span>♙</span><strong>As skipper</strong><b>860 nm</b><small>40%</small></article></div></section>}
      </section>
      </section>
    </main>
  );
}

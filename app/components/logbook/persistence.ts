import { moduleTabs } from "../../templates/app-shell";
import type { ActiveView } from "../../templates/ModuleTabs";
import type { PersistedLogbook, SheetCrewMember } from "../../models/logbook";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const routedModules = new Set<ActiveView>([...moduleTabs.map((tab) => tab.id), "profile", "admin"]);

export const createId = () => crypto.randomUUID();
export const numberOrZero = (value: string) => Number.parseFloat(value) || 0;
export const modulePath = (module: ActiveView, itemId?: string | number) => `/${module}${itemId !== undefined && itemId !== null ? `/${encodeURIComponent(String(itemId))}` : ""}`;

const isOpaqueId = (id: string) => uuidPattern.test(id);

type RouteState = { view: ActiveView; itemId?: string };

export function routeFromPathname(pathname: string): RouteState {
  const [, moduleSegment, itemSegment] = pathname.split("/");
  const view = routedModules.has(moduleSegment as ActiveView) ? moduleSegment as ActiveView : "dashboard";
  return { view, itemId: itemSegment ? decodeURIComponent(itemSegment) : undefined };
}

function normalizeSheetCrewMember(crew: SheetCrewMember | (Omit<SheetCrewMember, "embarkationDateTime" | "embarkationPosition" | "disembarkationDateTime" | "disembarkationPosition"> & { embarkation?: string; disembarkation?: string })): SheetCrewMember {
  if ("embarkationDateTime" in crew) return crew;
  const { embarkation = "", disembarkation = "", ...profile } = crew;
  return {
    ...profile,
    embarkationDateTime: "",
    embarkationPosition: embarkation,
    disembarkationDateTime: "",
    disembarkationPosition: disembarkation,
  };
}

function normalizeSheetCrew(logbook: PersistedLogbook) {
  return logbook.sheets.map((sheet) => ({ ...sheet, crew: sheet.crew.map(normalizeSheetCrewMember) }));
}

export function normalizeLogbookIds(logbook: PersistedLogbook): { logbook: PersistedLogbook; changed: boolean; boatIds: Map<string, string>; sheetIds: Map<string, string> } {
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

  const sourceCrew = logbook.crewMembers ?? [];
  const normalizedSheets = normalizeSheetCrew(logbook);
  if (!("crewMembers" in logbook)) changed = true;
  if (normalizedSheets.some((sheet, index) => sheet !== logbook.sheets[index])) changed = true;
  if (!changed) return { logbook: { ...logbook, crewMembers: sourceCrew, sheets: normalizedSheets }, changed, boatIds, sheetIds };
  return {
    changed,
    boatIds,
    sheetIds,
    logbook: {
      boats: logbook.boats.map((boat) => ({ ...boat, id: boatIds.get(boat.id) ?? boat.id })),
      crewMembers: sourceCrew,
      sheets: normalizedSheets.map((sheet) => ({ ...sheet, id: sheetIds.get(sheet.id) ?? sheet.id, boatId: boatIds.get(sheet.boatId) ?? sheet.boatId })),
    },
  };
}

export function persistLogbook(logbook: PersistedLogbook, options?: { signal?: AbortSignal; keepalive?: boolean }) {
  return fetch("/api/logbook", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(logbook),
    signal: options?.signal,
    keepalive: options?.keepalive,
  });
}

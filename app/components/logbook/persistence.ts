import { moduleTabs } from "../../templates/app-shell";
import type { ActiveView } from "../../templates/ModuleTabs";
import type { Boat, CrewMember, LogSheet, PersistedLogbook, SheetCrewMember } from "../../models/logbook";

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

export function normalizeLogbookIds(logbook: PersistedLogbook): { logbook: PersistedLogbook; changed: boolean; boatIds: Map<string, string>; crewIds: Map<string, string>; sheetIds: Map<string, string> } {
  const boatIds = new Map<string, string>();
  const crewIds = new Map<string, string>();
  const sheetIds = new Map<string, string>();
  let changed = false;

  for (const boat of logbook.boats) {
    if (!isOpaqueId(boat.id)) {
      boatIds.set(boat.id, createId());
      changed = true;
    }
  }
  const sourceCrew = logbook.crewMembers ?? [];
  for (const crew of sourceCrew) {
    if (!isOpaqueId(crew.id)) {
      crewIds.set(crew.id, createId());
      changed = true;
    }
  }
  for (const sheet of logbook.sheets) {
    if (!isOpaqueId(sheet.id)) {
      sheetIds.set(sheet.id, createId());
      changed = true;
    }
    if (boatIds.has(sheet.boatId)) changed = true;
    if (sheet.crew.some((crew) => crewIds.has(crew.id))) changed = true;
  }

  const normalizedSheets = normalizeSheetCrew(logbook);
  if (!("crewMembers" in logbook)) changed = true;
  if (normalizedSheets.some((sheet, index) => sheet !== logbook.sheets[index])) changed = true;
  if (!changed) return { logbook: { ...logbook, crewMembers: sourceCrew, sheets: normalizedSheets }, changed, boatIds, crewIds, sheetIds };
  return {
    changed,
    boatIds,
    crewIds,
    sheetIds,
    logbook: {
      boats: logbook.boats.map((boat) => ({ ...boat, id: boatIds.get(boat.id) ?? boat.id })),
      crewMembers: sourceCrew.map((crew) => ({ ...crew, id: crewIds.get(crew.id) ?? crew.id })),
      sheets: normalizedSheets.map((sheet) => ({
        ...sheet,
        id: sheetIds.get(sheet.id) ?? sheet.id,
        boatId: boatIds.get(sheet.boatId) ?? sheet.boatId,
        crew: sheet.crew.map((crew) => ({ ...crew, id: crewIds.get(crew.id) ?? crew.id })),
      })),
    },
  };
}

type RequestOptions = { signal?: AbortSignal; keepalive?: boolean };

function entityRequest(path: string, method: "POST" | "PUT" | "DELETE", entity?: Boat | CrewMember | LogSheet, options?: RequestOptions) {
  return fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: entity ? JSON.stringify(entity) : undefined,
    signal: options?.signal,
    keepalive: options?.keepalive,
  });
}

export const persistBoat = (boat: Boat, isNew = false, options?: RequestOptions) =>
  entityRequest(isNew ? "/api/logbook/boats" : `/api/logbook/boats/${encodeURIComponent(boat.id)}`, isNew ? "POST" : "PUT", boat, options);
export const persistCrewMember = (crew: CrewMember, isNew = false, options?: RequestOptions) =>
  entityRequest(isNew ? "/api/logbook/crew" : `/api/logbook/crew/${encodeURIComponent(crew.id)}`, isNew ? "POST" : "PUT", crew, options);
export const persistSheet = (sheet: LogSheet, isNew = false, options?: RequestOptions) =>
  entityRequest(isNew ? "/api/logbook/sheets" : `/api/logbook/sheets/${encodeURIComponent(sheet.id)}`, isNew ? "POST" : "PUT", sheet, options);
export const deleteLogbookEntity = (kind: "boat" | "crew" | "sheet", id: string, options?: RequestOptions) => {
  const collection = kind === "boat" ? "boats" : kind === "sheet" ? "sheets" : "crew";
  return entityRequest(`/api/logbook/${collection}/${encodeURIComponent(id)}`, "DELETE", undefined, options);
};

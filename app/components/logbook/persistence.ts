import { moduleTabs } from "../../templates/app-shell";
import type { ActiveView } from "../../templates/ModuleTabs";
import type { PersistedLogbook } from "../../models/logbook";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const routedModules = new Set<ActiveView>([...moduleTabs.map((tab) => tab.id), "profile"]);

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

export function persistLogbook(logbook: PersistedLogbook, options?: { signal?: AbortSignal; keepalive?: boolean }) {
  return fetch("/api/logbook", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(logbook),
    signal: options?.signal,
    keepalive: options?.keepalive,
  });
}

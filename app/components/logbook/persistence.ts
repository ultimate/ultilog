import { moduleTabs } from "../../templates/app-shell";
import type { ActiveView } from "../../templates/ModuleTabs";
import type { Boat, CrewMember, LogLine, LogSheet, PersistedLogbook } from "../../models/logbook";

const routedModules = new Set<ActiveView>([...moduleTabs.map((tab) => tab.id), "profile", "admin"]);

export const createId = () => crypto.randomUUID();
export const numberOrZero = (value: string) => Number.parseFloat(value) || 0;
export const modulePath = (module: ActiveView, itemId?: string | number) => `/${module}${itemId !== undefined && itemId !== null ? `/${encodeURIComponent(String(itemId))}` : ""}`;

type RouteState = { view: ActiveView; itemId?: string };

export function routeFromPathname(pathname: string): RouteState {
  const [, moduleSegment, itemSegment] = pathname.split("/");
  const view = routedModules.has(moduleSegment as ActiveView) ? moduleSegment as ActiveView : "dashboard";
  return { view, itemId: itemSegment ? decodeURIComponent(itemSegment) : undefined };
}

type RequestOptions = { signal?: AbortSignal; keepalive?: boolean };

export async function mutationErrorDetail(response?: Response, requestError?: unknown) {
  if (!response) {
    const message = requestError instanceof Error ? requestError.message : "The request did not reach the server.";
    return `Network error: ${message}`;
  }
  const payload = await response.clone().json().catch(() => undefined) as { error?: unknown; code?: unknown; reference?: unknown } | undefined;
  const error = typeof payload?.error === "string" ? payload.error : response.statusText || "Request rejected";
  const code = typeof payload?.code === "string" ? `, ${payload.code}` : "";
  const reference = typeof payload?.reference === "string" ? ` Reference: ${payload.reference}.` : "";
  return `HTTP ${response.status}${code}: ${error}${reference}`;
}

function entityRequest(path: string, method: "POST" | "PUT" | "DELETE", entity?: Boat | CrewMember | LogSheet | LogLine, options?: RequestOptions) {
  const withoutImageBytes = entity && "image" in entity
    ? { ...entity, image: undefined, imageId: entity.imageId ?? entity.image?.id,
        ...("crew" in entity ? { crew: entity.crew.map(member => ({ ...member, image: undefined, imageId: member.imageId ?? member.image?.id })) } : {}) }
    : entity;
  // Sheet metadata/assignment writes are deliberately independent from line
  // writes. Lines have stable-id endpoints and must never hitch a ride here.
  const focusedEntity = withoutImageBytes && "lines" in withoutImageBytes
    ? {
        ...Object.fromEntries(Object.entries(withoutImageBytes).filter(([key]) => key !== "lines")),
        crew: withoutImageBytes.crew.map(({ id, embarkationDateTime, embarkationPosition, disembarkationDateTime, disembarkationPosition }) =>
          ({ id, embarkationDateTime, embarkationPosition, disembarkationDateTime, disembarkationPosition })),
      }
    : withoutImageBytes;
  return fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: focusedEntity ? JSON.stringify(focusedEntity) : undefined,
    signal: options?.signal,
    keepalive: options?.keepalive,
  });
}

function deletionRequest(path: string, revision: number, options?: RequestOptions) {
  return fetch(path, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ revision }),
    signal: options?.signal,
    keepalive: options?.keepalive,
  });
}

/** Upload image bytes once. Entity writes subsequently carry only this stable id. */
export async function uploadStoredImage(image: import("../../models/stored-image").StoredImage) {
  const response = await fetch("/api/images", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(image) });
  if (!response.ok) throw new Error((await response.json().catch(() => ({})))?.error ?? "Image upload failed.");
  return response.json() as Promise<import("../../models/stored-image").StoredImage & { id: string }>;
}

export const persistBoat = (boat: Boat, isNew = false, options?: RequestOptions) =>
  entityRequest(isNew ? "/api/logbook/boats" : `/api/logbook/boats/${encodeURIComponent(boat.id)}`, isNew ? "POST" : "PUT", boat, options);
export const persistCrewMember = (crew: CrewMember, isNew = false, options?: RequestOptions) =>
  entityRequest(isNew ? "/api/logbook/crew" : `/api/logbook/crew/${encodeURIComponent(crew.id)}`, isNew ? "POST" : "PUT", crew, options);
export const persistSheet = (sheet: LogSheet, isNew = false, options?: RequestOptions) => {
  // Copy provenance is immutable server metadata, not part of focused writes.
  const { copyProvenance: _copyProvenance, ...focusedSheet } = sheet;
  return entityRequest(isNew ? "/api/logbook/sheets" : `/api/logbook/sheets/${encodeURIComponent(sheet.id)}`, isNew ? "POST" : "PUT", focusedSheet, options);
};
export const persistLogLine = (sheetId: string, line: LogLine, isNew: boolean) =>
  entityRequest(`/api/logbook/sheets/${encodeURIComponent(sheetId)}/lines${isNew ? "" : `/${encodeURIComponent(line.id)}`}`, isNew ? "POST" : "PUT", line);
export const deleteLogLine = (sheetId: string, lineId: string, revision: number) => deletionRequest(`/api/logbook/sheets/${encodeURIComponent(sheetId)}/lines/${encodeURIComponent(lineId)}`, revision);
export const reorderLogLines = (sheetId: string, lineIds: string[]) => fetch(`/api/logbook/sheets/${encodeURIComponent(sheetId)}/lines/reorder`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lineIds }) });
export const deleteLogbookEntity = (kind: "boat" | "crew" | "sheet", id: string, revision: number, options?: RequestOptions) => {
  const collection = kind === "boat" ? "boats" : kind === "sheet" ? "sheets" : "crew";
  return deletionRequest(`/api/logbook/${collection}/${encodeURIComponent(id)}`, revision, options);
};

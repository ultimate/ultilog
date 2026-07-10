import type { Boat } from "./boat";
import type { LogSheet } from "./log-sheet";

export type PersistedLogbook = {
  boats: Boat[];
  crewMembers: import("./crew-member").CrewMember[];
  sheets: LogSheet[];
};

export { defaultDeviationTable, deviationTableHeadings, normalizeDeviationTable } from "./boat";
export type { Boat, BoatType, DeviationTableRow } from "./boat";
export type { CrewMember, SheetCrewMember } from "./crew-member";
export type { LogLine, TemperatureUnit, WindUnit } from "./log-line";
export type { LogSheet } from "./log-sheet";

export type { BoatForm, CrewForm, LineForm, SheetForm } from "./logbook-forms";
export type { ScannerResult, ScannedLogLine, ScannedLogSheetDraft } from "./logbook-scanner";
export type { BoatRow, CrewMemberRow, LogLineRow, LogSheetRow, StoredLogSheet } from "./logbook-rows";

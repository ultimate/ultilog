import type { Boat } from "./boat";
import type { LogSheet } from "./log-sheet";

export type PersistedLogbook = {
  boats: Boat[];
  crewMembers: import("./crew-member").CrewMember[];
  sheets: LogSheet[];
};

export { defaultDeviationTable, defaultMainEngine, defaultWindDriftTable, deviationTableHeadings, normalizeDeviationTable, normalizeWindDriftTable, windDriftAngles, windDriftSailSettings } from "./boat";
export type { Boat, BoatEngine, BoatEngineRole, BoatType, DeviationTableRow, WindDriftAngle, WindDriftSailSetting, WindDriftTable, WindDriftTableRow } from "./boat";
export type { StoredImage } from "./stored-image";
export type { CrewMember, SheetCrewMember } from "./crew-member";
export type { LogLine, TemperatureUnit, WindUnit } from "./log-line";
export type { LogSheet, LogSheetSharePrivacy, LogSheetShareSettings, ScannerWarning } from "./log-sheet";
export { defaultLogSheetShareSettings } from "./log-sheet";

export type { BoatForm, CrewForm, LineForm, LineFormField, SheetForm } from "./logbook-forms";
export type { ScannerResult, ScannedLogLine, ScannedLogSheetDraft } from "./logbook-scanner";
export type { BoatRow, CrewMemberRow, LogLineRow, LogSheetRow, StoredLogSheet } from "./logbook-rows";

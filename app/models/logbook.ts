import type { Boat } from "./boat";
import type { LogSheet } from "./log-sheet";

export type PersistedLogbook = {
  boats: Boat[];
  sheets: LogSheet[];
};

export { defaultDeviationTable, deviationTableHeadings, normalizeDeviationTable } from "./boat";
export type { Boat, BoatType, DeviationTableRow } from "./boat";
export type { CrewMember } from "./crew-member";
export type { LogLine } from "./log-line";
export type { LogSheet } from "./log-sheet";

export type { BoatForm, CrewForm, LineForm, SheetForm } from "./logbook-forms";
export type { BoatRow, CrewMemberRow, LogLineRow, LogSheetRow, StoredLogSheet } from "./logbook-rows";

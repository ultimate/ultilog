import type { FocusedLogSheet, LogSheet, SheetCrewAssignment } from "../../models/logbook";
import { LogbookValidationError, requireRevision, validatePersistedLogbook } from "./logbook";

export function validateLogSheet(value: unknown): LogSheet {
  const boat = { id: "validation-boat", name: "", type: "Sail", registration: "", flagState: "", homePort: "", owner: "", dimensions: "", logfactor: 1, yachtData: {}, deviationTable: [] };
  const sheet = validatePersistedLogbook({ boats: [boat], crewMembers: [], sheets: [value] }).sheets[0];
  if (!sheet.lines.every(line => typeof line.id === "string")) throw new LogbookValidationError("Every log line must have an id.");
  return sheet;
}

/** Focused sheet requests omit log lines; line routes own that collection. */
export function validateFocusedLogSheet(value: unknown): FocusedLogSheet {
  if (!value || typeof value !== "object" || Array.isArray(value) || "lines" in value) throw new LogbookValidationError("Focused sheet payloads must omit lines.");
  const crew = (value as { crew?: unknown }).crew;
  if (!Array.isArray(crew)) throw new LogbookValidationError("sheet crew must be an array.");
  const assignmentKeys = ["id", "embarkationDateTime", "embarkationPosition", "disembarkationDateTime", "disembarkationPosition"] as const;
  crew.forEach((assignment, index) => {
    if (!assignment || typeof assignment !== "object" || Array.isArray(assignment)
      || Object.keys(assignment).some(key => !assignmentKeys.includes(key as typeof assignmentKeys[number]))
      || !assignmentKeys.every(key => typeof (assignment as Record<string, unknown>)[key] === "string")) {
      throw new LogbookValidationError(`sheet crew assignment ${index} is malformed.`);
    }
  });
  const validated = validateLogSheet({ ...value, crew: crew.map(assignment => ({ ...assignment as SheetCrewAssignment, name: "", nationality: "", role: "" })), lines: [] });
  const { lines: _lines, ...focused } = validated;
  return { ...focused, crew: crew as SheetCrewAssignment[] };
}


export function validateFocusedLogSheetUpdate(value: unknown): FocusedLogSheet {
  requireRevision(value);
  return validateFocusedLogSheet(value);
}

import type { LogSheet } from "../../models/logbook";
import { LogbookValidationError, validatePersistedLogbook } from "./logbook";

export function validateLogSheet(value: unknown): LogSheet {
  const boat = { id: "validation-boat", name: "", type: "Sail", registration: "", flagState: "", homePort: "", owner: "", dimensions: "", logfactor: 1, yachtData: {}, deviationTable: [] };
  const sheet = validatePersistedLogbook({ boats: [boat], crewMembers: [], sheets: [value] }).sheets[0];
  if (!sheet.lines.every(line => typeof line.id === "string")) throw new LogbookValidationError("Every log line must have an id.");
  return sheet;
}

/** Focused sheet requests omit log lines; line routes own that collection. */
export function validateFocusedLogSheet(value: unknown): LogSheet {
  if (!value || typeof value !== "object" || Array.isArray(value) || "lines" in value) throw new LogbookValidationError("Focused sheet payloads must omit lines.");
  return validateLogSheet({ ...value, lines: [] });
}

import type { LogLine } from "../../models/logbook";
import { LOGBOOK_LIMITS, LogbookValidationError, validateLine as assertLine } from "./logbook";

export function validateLogLine(value: unknown): LogLine {
  assertLine(value);
  if (typeof (value as { id?: unknown }).id !== "string" || !(value as { id: string }).id.trim()) throw new LogbookValidationError("A log line id is required.");
  return value as LogLine;
}

export function validateLineOrder(value: unknown): string[] {
  if (!value || typeof value !== "object" || !Array.isArray((value as { lineIds?: unknown }).lineIds)) throw new LogbookValidationError("lineIds must be an array.");
  const ids = (value as { lineIds: unknown[] }).lineIds;
  if (ids.length > LOGBOOK_LIMITS.logLines || !ids.every(id => typeof id === "string" && id.length > 0) || new Set(ids).size !== ids.length) throw new LogbookValidationError("lineIds is invalid.");
  return ids as string[];
}

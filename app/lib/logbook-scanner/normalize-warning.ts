import { randomUUID } from "node:crypto";
import type { ScannerWarning } from "../../models/logbook";
import type { LineFormField } from "../../models/logbook-forms";
import { scannerWarningCodes } from "./warning-codes";
import { scannerFieldAliases } from "./field-aliases";

const simpleLegacyCodes: Record<string, ScannerWarning["code"]> = {
  "Missing or unclear sheet title.": "missingSheetTitle", "Missing or unclear sheet date range.": "missingSheetDate",
  "Missing or unclear route origin.": "missingRouteOrigin", "Missing or unclear route destination.": "missingRouteDestination",
  "Missing or unclear departure time.": "missingDepartureTime", "Missing or unclear arrival time.": "missingArrivalTime",
  "No logbook rows were detected.": "noRows",
  "A log-line date rollover would exceed the sheet end date; the inferred date was capped at the end date.": "rolloverExceededEndDate",
  "Detected a missing magnetic-course column and remapped the following variation and true-course columns.": "shiftedMissingMagneticCourse",
  "No images were provided for scanning.": "noImages",
};
const fields = Object.keys(scannerFieldAliases) as LineFormField[];

export function diagnosticFromLegacyMessage(message: string): Omit<ScannerWarning, "id" | "acknowledgedAt"> {
  const code = simpleLegacyCodes[message];
  if (code) return { code };
  const row = Number(message.match(/^Row (\d+)\b/)?.[1]);
  const mentioned = fields.filter(field => new RegExp(`\\b${field}\\b`, "i").test(message));
  if (row && /missing or unclear:/i.test(message)) return { code: "missingFields", row, fields: mentioned };
  if (row && /incomplete course chain/i.test(message)) return { code: "incompleteCourseChain", row, fields: mentioned };
  if (row && /inconsistent course conversion/i.test(message)) return { code: "inconsistentCourseConversion", row, fields: mentioned };
  return { code: "scannerGenerated", fallbackMessage: message };
}

export function normalizeScannerWarning(value: unknown): ScannerWarning | undefined {
  if (typeof value === "string") return { id: randomUUID(), ...diagnosticFromLegacyMessage(value) };
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const item = value as Record<string, unknown>;
  if (typeof item.id !== "string") return undefined;
  const acknowledgedAt = typeof item.acknowledgedAt === "string" ? item.acknowledgedAt : undefined;
  if (typeof item.code === "string" && scannerWarningCodes.includes(item.code as ScannerWarning["code"])) {
    return { id: item.id, code: item.code as ScannerWarning["code"], ...(Number.isInteger(item.row) ? { row: item.row as number } : {}), ...(Array.isArray(item.fields) ? { fields: item.fields.filter(field => fields.includes(field as LineFormField)) as LineFormField[] } : {}), ...(typeof item.fallbackMessage === "string" ? { fallbackMessage: item.fallbackMessage } : {}), ...(acknowledgedAt ? { acknowledgedAt } : {}) };
  }
  if (typeof item.message === "string") return { id: item.id, ...diagnosticFromLegacyMessage(item.message), ...(acknowledgedAt ? { acknowledgedAt } : {}) };
}

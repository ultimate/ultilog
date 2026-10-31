import type { ScannerWarningDiagnostic } from "./warning-codes";

const fieldDiagnostics = new Set(["missingFields", "incompleteCourseChain", "inconsistentCourseConversion"]);

/** Field diagnostics need a usable target; sheet-wide diagnostics do not. */
export function isActionableScannerWarning(warning: ScannerWarningDiagnostic): boolean {
  if (fieldDiagnostics.has(warning.code)) {
    return Number.isSafeInteger(warning.row) && Number(warning.row) > 0 && Boolean(warning.fields?.length);
  }
  if (warning.code === "scannerGenerated") return Boolean(warning.fallbackMessage?.trim());
  return true;
}

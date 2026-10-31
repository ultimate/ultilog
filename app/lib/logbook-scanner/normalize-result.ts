import type { ScannerResult } from "../../models/logbook-scanner";
import { isActionableScannerWarning } from "./actionable-warning";

const unitFields = new Set(["temperatureUnit", "windUnit", "seaUnit", "tideUnit"]);

/** Printed units alone are not evidence of a populated log row. */
export function normalizeScannerRows(result: ScannerResult): ScannerResult {
  const rowNumbers = new Map<number, number>();
  const lines = result.draft.lines.filter((line, index) => {
    const populated = Object.entries(line).some(([field, value]) => !unitFields.has(field) && value?.trim());
    if (populated) rowNumbers.set(index + 1, rowNumbers.size + 1);
    return populated;
  });
  return {
    draft: { ...result.draft, lines },
    warnings: result.warnings.flatMap(warning => {
      if (!isActionableScannerWarning(warning)) return [];
      if (warning.row === undefined) return [warning];
      const row = rowNumbers.get(warning.row);
      return row ? [{ ...warning, row }] : [];
    }),
  };
}

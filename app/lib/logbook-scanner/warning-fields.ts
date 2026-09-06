import type { LineFormField } from "../../models/logbook-forms";
import type { ScannerWarning } from "../../models/logbook";

export type ScannerWarningIndex = {
  lineFields: Map<number, Map<LineFormField, ScannerWarning[]>>;
  lineWarnings: Map<number, ScannerWarning[]>;
  unmatched: ScannerWarning[];
};

/** Associates the scanner's persisted human-readable diagnostics with table fields. */
export function indexScannerWarnings(warnings: readonly ScannerWarning[]): ScannerWarningIndex {
  const result: ScannerWarningIndex = { lineFields: new Map(), lineWarnings: new Map(), unmatched: [] };

  for (const warning of warnings) {
    if (!warning.row) {
      result.unmatched.push(warning);
      continue;
    }
    if (!warning.fields?.length) {
      append(result.lineWarnings, warning.row, warning);
      continue;
    }
    let rowFields = result.lineFields.get(warning.row);
    if (!rowFields) { rowFields = new Map(); result.lineFields.set(warning.row, rowFields); }
    for (const field of warning.fields) append(rowFields, field, warning);
  }
  return result;
}


function append<K>(map: Map<K, ScannerWarning[]>, key: K, warning: ScannerWarning) {
  const current = map.get(key) ?? [];
  if (!current.some((candidate) => candidate.id === warning.id)) map.set(key, [...current, warning]);
}

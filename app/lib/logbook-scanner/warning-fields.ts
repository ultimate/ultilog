import type { LineFormField } from "../../models/logbook-forms";
import { scannerFieldAliases } from "./field-aliases";

export type ScannerWarningIndex = {
  lineFields: Map<number, Map<LineFormField, string[]>>;
  lineWarnings: Map<number, string[]>;
  unmatched: string[];
};

const fieldNames = Object.keys(scannerFieldAliases) as LineFormField[];

/** Associates the scanner's persisted human-readable diagnostics with table fields. */
export function indexScannerWarnings(warnings: readonly string[]): ScannerWarningIndex {
  const result: ScannerWarningIndex = { lineFields: new Map(), lineWarnings: new Map(), unmatched: [] };

  for (const warning of warnings) {
    const rowMatch = warning.match(/^\s*Row\s+(\d+)\b/i);
    if (!rowMatch) {
      result.unmatched.push(warning);
      continue;
    }

    const row = Number(rowMatch[1]);
    const fields = fieldsMentionedBy(warning);
    if (fields.length === 0) {
      append(result.lineWarnings, row, warning);
      continue;
    }

    let rowFields = result.lineFields.get(row);
    if (!rowFields) {
      rowFields = new Map();
      result.lineFields.set(row, rowFields);
    }
    for (const field of fields) append(rowFields, field, warning);
  }

  return result;
}

function fieldsMentionedBy(warning: string): LineFormField[] {
  const normalized = warning.toLocaleLowerCase();
  return fieldNames.filter((field) => {
    const terms = [field, ...Object.values(scannerFieldAliases[field]).flat()];
    return terms.some((term) => containsTerm(normalized, term.toLocaleLowerCase()));
  });
}

function containsTerm(text: string, term: string) {
  if (term.length < 3) return false;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`, "iu").test(text);
}

function append<K>(map: Map<K, string[]>, key: K, warning: string) {
  const current = map.get(key) ?? [];
  if (!current.includes(warning)) map.set(key, [...current, warning]);
}

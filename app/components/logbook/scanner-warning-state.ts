import type { LogSheet } from "../../models/logbook";
import { updateScannerWarnings } from "../../lib/logbook-scanner/update-warnings";
import { mergeMutationResult } from "./mutation-merge";

/** Refresh only warning metadata; never roll back line edits or a newer review. */
export function mergeScannerWarningState(current: LogSheet, submitted: LogSheet, persisted: LogSheet): LogSheet {
  if ((persisted.revision ?? 0) < (current.revision ?? 0)) return current;
  const submittedWarnings = new Map(submitted.scannerWarnings?.map(warning => [warning.id, warning]));
  const currentWarnings = new Map(current.scannerWarnings?.map(warning => [warning.id, warning]));
  const warnings = updateScannerWarnings(persisted.scannerWarnings ?? [], persisted.lines, current.lines).flatMap(warning => {
    const local = currentWarnings.get(warning.id);
    const prior = submittedWarnings.get(warning.id);
    if (prior && !local) return [];
    // Local row remapping is independent of review. Only an actual review change
    // made while fetching should take precedence over the saved acknowledgment.
    if (local && local.acknowledgedAt !== prior?.acknowledgedAt) {
      const { acknowledgedAt: _acknowledgedAt, ...rest } = warning;
      return [{ ...rest, ...(local.acknowledgedAt ? { acknowledgedAt: local.acknowledgedAt } : {}) }];
    }
    return [warning];
  });
  const persistedIds = new Set(warnings.map(warning => warning.id));
  for (const warning of current.scannerWarnings ?? []) {
    if (!submittedWarnings.has(warning.id) && !persistedIds.has(warning.id)) warnings.push(warning);
  }
  const metadata = mergeMutationResult(current, submitted, {
    ...submitted,
    revision: persisted.revision,
    updatedAt: persisted.updatedAt,
    scannerWarningsDismissed: persisted.scannerWarningsDismissed,
  });
  return { ...metadata, scannerWarnings: warnings, lines: current.lines };
}

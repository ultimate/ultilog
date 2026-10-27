import { describe, expect, it } from "vitest";
import { mergeScannerWarningState } from "../../app/components/logbook/scanner-warning-state";
import { sampleLogSheets } from "../fixtures/logbook";
import type { LogSheet } from "../../app/models/logbook";

const first = { ...sampleLogSheets[0].lines[0], id: "first" };
const second = { ...first, id: "second" };
const original: LogSheet = { ...sampleLogSheets[0], source: "scanner", revision: 1, lines: [first, second], scannerWarnings: [{ id: "warning", code: "missingFields", row: 1, fields: ["latitude"] }] };
const persisted: LogSheet = { ...original, revision: 2, scannerWarnings: [{ ...original.scannerWarnings![0], acknowledgedAt: "2026-10-26T12:00:00Z" }] };

describe("scanner warning refresh", () => {
  it("shows persisted acknowledgment and revision without overwriting in-flight line edits", () => {
    const current = { ...original, lines: [{ ...first, remarks: "still typing" }, second] };
    const result = mergeScannerWarningState(current, original, persisted);
    expect(result.scannerWarnings).toEqual(persisted.scannerWarnings);
    expect(result.revision).toBe(2);
    expect(result.lines).toBe(current.lines);
  });
  it("maps fetched warnings into a newer local line order", () => {
    const current = { ...original, lines: [second, first], scannerWarnings: [{ ...original.scannerWarnings![0], row: 2 }] };
    const result = mergeScannerWarningState(current, original, persisted);
    expect(result.scannerWarnings?.[0]).toMatchObject({ row: 2, acknowledgedAt: "2026-10-26T12:00:00Z" });
  });
  it("preserves warning review changed while the refresh was pending", () => {
    const submitted = persisted;
    const current = { ...submitted, scannerWarnings: original.scannerWarnings };
    expect(mergeScannerWarningState(current, submitted, persisted).scannerWarnings).toEqual(original.scannerWarnings);
    const newer = { ...current, revision: 3 };
    expect(mergeScannerWarningState(newer, submitted, persisted)).toBe(newer);
  });
  it("refreshes the revision even after the last warned line was deleted", () => {
    const current = { ...original, lines: [second], scannerWarnings: [] };
    const deleted = { ...current, revision: 2 };
    const result = mergeScannerWarningState(current, current, deleted);
    expect(result.revision).toBe(2);
    expect(result.scannerWarnings).toEqual([]);
  });
});

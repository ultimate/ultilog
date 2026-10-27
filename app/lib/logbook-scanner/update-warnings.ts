import type { LogLine, ScannerWarning } from "../../models/logbook";

/** Resolve the old row number through its stable line ID before changing order. */
export function updateScannerWarnings(
  warnings: readonly ScannerWarning[],
  before: readonly LogLine[],
  after: readonly LogLine[],
  acknowledgedAt?: string,
): ScannerWarning[] {
  const positions = new Map(after.map((line, index) => [line.id, index]));
  return warnings.flatMap(warning => {
    if (warning.row === undefined) return [warning];
    const previous = before[warning.row - 1];
    if (!previous) return [warning]; // Preserve historical unmatched diagnostics for manual review.
    const index = positions.get(previous.id);
    if (index === undefined) return [];
    const current = after[index];
    const changed = warning.fields?.some(field => {
      if (field === "motorHours") {
        const engines = new Set([...Object.keys(previous.engineHours ?? {}), ...Object.keys(current.engineHours ?? {})]);
        return [...engines].some(id => previous.engineHours?.[id] !== current.engineHours?.[id]);
      }
      if (field === "temperatureUnit") return previous.temperatureUnit.toLowerCase().replace("°", "") !== current.temperatureUnit.toLowerCase().replace("°", "");
      if (field === "time") {
        const oldTime = Date.parse(previous.time);
        const newTime = Date.parse(current.time);
        if (Number.isFinite(oldTime) && Number.isFinite(newTime)) return oldTime !== newTime;
      }
      return previous[field] !== current[field];
    });
    return [{ ...warning, row: index + 1, ...(!warning.acknowledgedAt && changed && acknowledgedAt ? { acknowledgedAt } : {}) }];
  });
}

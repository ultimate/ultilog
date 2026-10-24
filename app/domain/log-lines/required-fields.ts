import { normalizeIsoDate } from "../../lib/iso-date";
import type { LogLine } from "../../models/logbook";

export function hasRequiredLogLineFields(line: LogLine) {
  return /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.test(line.time)
    && Boolean(normalizeIsoDate(line.time))
    && Number.isFinite(Date.parse(line.time))
    && line.latitude !== null && Number.isFinite(line.latitude) && Math.abs(line.latitude) <= 90
    && line.longitude !== null && Number.isFinite(line.longitude) && Math.abs(line.longitude) <= 180;
}

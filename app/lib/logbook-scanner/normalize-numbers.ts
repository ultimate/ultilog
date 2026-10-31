import type { ScannerResult, ScannedLogLine } from "../../models/logbook-scanner";
import { parseDecimalInput, parseHourInput } from "../log-input";

const courseFields = new Set(["compassCourse", "deviation", "magneticCourse", "variation", "trueCourse", "windDrift", "courseThroughWater", "currentDrift", "courseOverGround"]);
const numericFields = [
  "temperature", "barometer", "windStrength", "waves", "tide",
  "compassCourse", "deviation", "magneticCourse", "variation", "trueCourse",
  "windDrift", "courseThroughWater", "currentDrift", "courseOverGround",
  "speedKn", "logNm", "sailMiles", "motorMiles", "motorHours",
] as const satisfies readonly (keyof ScannedLogLine)[];

type UnitField = "temperatureUnit" | "windUnit" | "seaUnit" | "tideUnit";
const units: Record<UnitField, Record<string, string>> = {
  temperatureUnit: { "°c": "°C", c: "°C", celsius: "°C", "°f": "°F", f: "°F", fahrenheit: "°F" },
  windUnit: { kn: "kn", kt: "kn", kts: "kn", knot: "kn", knots: "kn", bft: "bft", bf: "bft", beaufort: "bft", "km/h": "km/h", kph: "km/h", "mp/h": "mp/h", mph: "mp/h", "m/s": "m/s" },
  seaUnit: { m: "m", meter: "m", meters: "m", metre: "m", metres: "m", ft: "ft", foot: "ft", feet: "ft" },
  tideUnit: { m: "m", meter: "m", meters: "m", metre: "m", metres: "m", ft: "ft", foot: "ft", feet: "ft" },
};
const unitFields: Partial<Record<(typeof numericFields)[number], UnitField>> = { temperature: "temperatureUnit", windStrength: "windUnit", waves: "seaUnit", tide: "tideUnit" };
const unitKey = (value: string) => value.trim().toLowerCase().replace(/\s+/g, "");

/** Split known OCR units without guessing ranges, converting units, or accepting partial numbers. */
export function normalizeScannedNumbers(result: ScannerResult): ScannerResult {
  const warnings = [...result.warnings];
  const lines = result.draft.lines.map((source, index) => {
    const line = { ...source };
    for (const field of Object.keys(units) as UnitField[]) {
      const canonical = units[field][unitKey(source[field] ?? "")];
      if (canonical) line[field] = canonical;
    }
    for (const field of numericFields) {
      const value = source[field];
      if (value === undefined) continue;
      try {
        let text = value.trim().replace(/\u2212/g, "-");
        // Log counters may use Swiss apostrophes or spaces as thousands separators.
        // Require full groups of three; never join unrelated numbers or a range.
        if (["logNm", "sailMiles", "motorMiles"].includes(field)) {
          text = text.replace(/^([+-]?\d{1,3}(?:['’\s]\d{3})+(?:[.,]\d+)?)(?=\s*(?:[a-zA-Z]|$))/, number => number.replace(/['’\s]/g, ""));
        }
        // The entire cell must be a number followed by an optional known unit.
        const match = /^([+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)(?::[0-5]\d)?)\s*(.*?)$/.exec(text);
        let number = text;
        let embeddedUnit: string | undefined;
        const unitField = unitFields[field];
        if (match?.[2]) {
          number = match[1];
          const suffix = unitKey(match[2]).replace(/\.$/, "");
          if (unitField) {
            embeddedUnit = units[unitField][suffix];
            if (!embeddedUnit) throw new Error("Unknown unit");
            const separate = unitKey(source[unitField] ?? "");
            if (separate && units[unitField][separate] !== embeddedUnit) throw new Error("Conflicting units");
          } else {
            const valid = courseFields.has(field) ? /^(?:°|deg|degrees?)$/.test(suffix)
              : field === "barometer" ? /^(?:hpa|mbar|mb)$/.test(suffix)
              : field === "speedKn" ? /^(?:kn|kt|kts|knots?|knoten|nds?)$/.test(suffix)
              : field === "motorHours" ? /^(?:h|hr|hrs|hours?)$/.test(suffix)
              : /^(?:nm|nmi|sm|nauticalmiles?)$/.test(suffix);
            if (!valid) throw new Error("Unknown unit");
          }
        }
        if (field === "motorHours") parseHourInput(number);
        else parseDecimalInput(number);
        line[field] = number;
        if (unitField && embeddedUnit) line[unitField] = embeddedUnit;
      } catch {
        line[field] = "";
        warnings.push({
          code: "scannerGenerated", row: index + 1, fields: [field, ...(unitFields[field] ? [unitFields[field]!] : [])],
          fallbackMessage: `${field}: the scanned value ${JSON.stringify(value)} could not be read unambiguously and was left empty. Please check the source image.`,
        });
      }
    }
    return line;
  });
  return { draft: { ...result.draft, lines }, warnings };
}

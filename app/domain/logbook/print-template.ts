import type { LogLine } from "../../models/logbook";
import type { Locale, TranslationKey } from "../../lib/i18n/translations";

export const LOG_SHEET_PRINT_TEMPLATE_ID = "ultilog-logsheet";
export const LOG_SHEET_PRINT_TEMPLATE_REVISION = 1;

export type LogSheetPrintVariant = "full" | "compact";
export type PrintLogColumnId =
  | "time"
  | "position"
  | "weather"
  | "temperature"
  | "barometer"
  | "wind"
  | "waves"
  | "tide"
  | "compassCourse"
  | "deviation"
  | "magneticCourse"
  | "variation"
  | "trueCourse"
  | "windDrift"
  | "courseThroughWater"
  | "currentDrift"
  | "courseOverGround"
  | "speedKn"
  | "logNm"
  | "sailMiles"
  | "motor"
  | "remarks";

export type PrintLogColumn = {
  id: PrintLogColumnId;
  headingKey: TranslationKey;
  sourceFields: readonly (keyof LogLine)[];
  expectedValue: "text" | "number" | "degrees" | "signed-degrees" | "composite";
  className: string;
  width: Readonly<Record<LogSheetPrintVariant, number>>;
  variants: readonly LogSheetPrintVariant[];
};

const bothVariants = ["full", "compact"] as const;
const fullVariant = ["full"] as const;

/**
 * The versioned column contract shared by print rendering and, in a later
 * milestone, template-aware scanning. Widths are relative weights.
 */
export const logSheetPrintTemplate = {
  id: LOG_SHEET_PRINT_TEMPLATE_ID,
  revision: LOG_SHEET_PRINT_TEMPLATE_REVISION,
  columns: [
    column("time", "print.column.time", ["time"], "text", "print-col-time", 4, 4),
    column("position", "print.column.position", ["position", "latitude", "longitude"], "composite", "print-col-position", 9, 11),
    column("weather", "print.column.weather", ["weather", "weatherRemark"], "composite", "print-col-weather", 6, 8),
    column("temperature", "print.column.temperature", ["temperature", "temperatureUnit"], "composite", "print-col-temp", 3.5, 3.5),
    column("barometer", "print.column.barometer", ["barometer"], "number", "print-col-baro", 3.5, 3.5),
    column("wind", "print.column.wind", ["windDirection", "windStrength", "windUnit"], "composite", "print-col-wind", 6, 8),
    column("waves", "print.column.sea", ["waves", "seaUnit"], "composite", "print-col-sea", 4, 5),
    column("tide", "print.column.tide", ["tide", "tideUnit"], "composite", "print-col-tide", 3, 3.5),
    column("compassCourse", "print.column.compassCourse", ["compassCourse"], "degrees", "print-col-course", 2.5, 2.5),
    column("deviation", "print.column.deviation", ["deviation"], "signed-degrees", "print-col-course", 2.5, 0, fullVariant),
    column("magneticCourse", "print.column.magneticCourse", ["magneticCourse"], "degrees", "print-col-course", 2.5, 0, fullVariant),
    column("variation", "print.column.variation", ["variation"], "signed-degrees", "print-col-course", 2.5, 0, fullVariant),
    column("trueCourse", "print.column.trueCourse", ["trueCourse"], "degrees", "print-col-course", 2.5, 0, fullVariant),
    column("windDrift", "print.column.windDrift", ["windDrift"], "signed-degrees", "print-col-course", 2.5, 0, fullVariant),
    column("courseThroughWater", "print.column.courseThroughWater", ["courseThroughWater"], "degrees", "print-col-course", 2.5, 0, fullVariant),
    column("currentDrift", "print.column.currentDrift", ["currentDrift"], "signed-degrees", "print-col-course", 2.5, 0, fullVariant),
    column("courseOverGround", "print.column.courseOverGround", ["courseOverGround"], "degrees", "print-col-course", 2.5, 2.5),
    column("speedKn", "print.column.speed", ["speedKn"], "number", "print-col-speed", 4.5, 4.5),
    column("logNm", "print.column.log", ["logNm"], "number", "print-col-log", 3.5, 3.5),
    column("sailMiles", "print.column.sail", ["sailMiles"], "number", "print-col-sail", 4, 4),
    column("motor", "print.column.motor", ["motorMiles", "motorHours"], "composite", "print-col-motor", 4, 4),
    column("remarks", "print.column.remarks", ["remarks"], "text", "print-col-remarks", 14.5, 29),
  ],
} as const satisfies { id: string; revision: number; columns: readonly PrintLogColumn[] };

export function getPrintLogColumns(variant: LogSheetPrintVariant): readonly PrintLogColumn[] {
  return logSheetPrintTemplate.columns.filter((candidate) => candidate.variants.includes(variant));
}

/** Stable, privacy-safe marker printed on every page for template recognition. */
export function formatLogSheetPrintTemplateMarker(variant: LogSheetPrintVariant, locale: Locale) {
  return `ULTILOG:${LOG_SHEET_PRINT_TEMPLATE_ID}:v${LOG_SHEET_PRINT_TEMPLATE_REVISION}:${variant}:${locale}`;
}

function column(
  id: PrintLogColumnId,
  headingKey: TranslationKey,
  sourceFields: readonly (keyof LogLine)[],
  expectedValue: PrintLogColumn["expectedValue"],
  className: string,
  fullWidth: number,
  compactWidth: number,
  variants: readonly LogSheetPrintVariant[] = bothVariants,
): PrintLogColumn {
  return {
    id,
    headingKey,
    sourceFields,
    expectedValue,
    className,
    width: { full: fullWidth, compact: compactWidth },
    variants,
  };
}

import type { LogLine } from "../../models/logbook";

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
  heading: string;
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
    column("time", "Time", ["time"], "text", "print-col-time", 4, 4),
    column("position", "Pos.", ["position", "latitude", "longitude"], "composite", "print-col-position", 9, 11),
    column("weather", "Wx", ["weather", "weatherRemark"], "composite", "print-col-weather", 6, 8),
    column("temperature", "Temp", ["temperature", "temperatureUnit"], "composite", "print-col-temp", 3.5, 3.5),
    column("barometer", "Baro", ["barometer"], "number", "print-col-baro", 3.5, 3.5),
    column("wind", "Wind", ["windDirection", "windStrength", "windUnit"], "composite", "print-col-wind", 6, 8),
    column("waves", "Sea", ["waves", "seaUnit"], "composite", "print-col-sea", 4, 5),
    column("tide", "Tide", ["tide", "tideUnit"], "composite", "print-col-tide", 3, 3.5),
    column("compassCourse", "CC", ["compassCourse"], "degrees", "print-col-course", 2.5, 2.5),
    column("deviation", "Dev", ["deviation"], "signed-degrees", "print-col-course", 2.5, 0, fullVariant),
    column("magneticCourse", "MC", ["magneticCourse"], "degrees", "print-col-course", 2.5, 0, fullVariant),
    column("variation", "Var", ["variation"], "signed-degrees", "print-col-course", 2.5, 0, fullVariant),
    column("trueCourse", "TC", ["trueCourse"], "degrees", "print-col-course", 2.5, 0, fullVariant),
    column("windDrift", "WD", ["windDrift"], "signed-degrees", "print-col-course", 2.5, 0, fullVariant),
    column("courseThroughWater", "CTW", ["courseThroughWater"], "degrees", "print-col-course", 2.5, 0, fullVariant),
    column("currentDrift", "CD", ["currentDrift"], "signed-degrees", "print-col-course", 2.5, 0, fullVariant),
    column("courseOverGround", "COG", ["courseOverGround"], "degrees", "print-col-course", 2.5, 2.5),
    column("speedKn", "Spd", ["speedKn"], "number", "print-col-speed", 3, 3),
    column("logNm", "Log", ["logNm"], "number", "print-col-log", 3, 3),
    column("sailMiles", "Sail", ["sailMiles"], "number", "print-col-sail", 3, 3),
    column("motor", "Mot", ["motorMiles", "motorHours"], "composite", "print-col-motor", 4, 4),
    column("remarks", "Remarks", ["remarks"], "text", "print-col-remarks", 17.5, 32),
  ],
} as const satisfies { id: string; revision: number; columns: readonly PrintLogColumn[] };

export function getPrintLogColumns(variant: LogSheetPrintVariant): readonly PrintLogColumn[] {
  return logSheetPrintTemplate.columns.filter((candidate) => candidate.variants.includes(variant));
}

function column(
  id: PrintLogColumnId,
  heading: string,
  sourceFields: readonly (keyof LogLine)[],
  expectedValue: PrintLogColumn["expectedValue"],
  className: string,
  fullWidth: number,
  compactWidth: number,
  variants: readonly LogSheetPrintVariant[] = bothVariants,
): PrintLogColumn {
  return {
    id,
    heading,
    sourceFields,
    expectedValue,
    className,
    width: { full: fullWidth, compact: compactWidth },
    variants,
  };
}

import type { LineFormField } from "../../models/logbook-forms";

export const scannerWarningCodes = [
  "missingSheetTitle", "missingSheetDate", "missingRouteOrigin", "missingRouteDestination",
  "missingDepartureTime", "missingArrivalTime", "noRows", "missingFields",
  "incompleteCourseChain", "inconsistentCourseConversion", "rolloverExceededEndDate",
  "shiftedMissingMagneticCourse", "noImages", "scannerGenerated",
] as const;
export type ScannerWarningCode = typeof scannerWarningCodes[number];

export type ScannerWarningDiagnostic = {
  code: ScannerWarningCode;
  row?: number;
  fields?: LineFormField[];
  fallbackMessage?: string;
};

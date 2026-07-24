import type { StoredImage } from "./stored-image";

export type BoatType = "Sail" | "Motor";

export type DeviationTableRow = {
  heading: number;
  deviation: string;
};

export type WindDriftAngle = "closeHauled" | "beamReach" | "broadReach";
export type WindDriftSailSetting = "fullSail" | "secondReef" | "stormSail";

export type WindDriftTableRow = {
  angle: WindDriftAngle;
  values: Record<WindDriftSailSetting, string>;
};

export const deviationTableHeadings = Array.from({ length: 36 }, (_, index) => index * 10);
export const windDriftAngles: WindDriftAngle[] = ["closeHauled", "beamReach", "broadReach"];
export const windDriftSailSettings: WindDriftSailSetting[] = ["fullSail", "secondReef", "stormSail"];

export function defaultDeviationTable(): DeviationTableRow[] {
  return deviationTableHeadings.map((heading) => ({ heading, deviation: "" }));
}

export function normalizeDeviationTable(rows: DeviationTableRow[] = []): DeviationTableRow[] {
  const rowsByHeading = new Map(rows.map((row) => [row.heading, row.deviation]));
  return deviationTableHeadings.map((heading) => ({ heading, deviation: rowsByHeading.get(heading) ?? "" }));
}

export function defaultWindDriftTable(): WindDriftTableRow[] {
  return windDriftAngles.map((angle) => ({ angle, values: { fullSail: "", secondReef: "", stormSail: "" } }));
}

export function normalizeWindDriftTable(rows: WindDriftTableRow[] = []): WindDriftTableRow[] {
  const rowsByAngle = new Map(rows.map((row) => [row.angle, row.values]));
  return windDriftAngles.map((angle) => ({
    angle,
    values: {
      fullSail: rowsByAngle.get(angle)?.fullSail ?? "",
      secondReef: rowsByAngle.get(angle)?.secondReef ?? "",
      stormSail: rowsByAngle.get(angle)?.stormSail ?? "",
    },
  }));
}

export type Boat = {
  id: string;
  name: string;
  type: BoatType;
  registration: string;
  flagState: string;
  homePort: string;
  owner: string;
  dimensions: string;
  logfactor: number;
  yachtData: Record<string, string>;
  deviationTable: DeviationTableRow[];
  windDriftTable?: WindDriftTableRow[];
  image?: StoredImage;
};

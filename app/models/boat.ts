import type { StoredImage } from "./stored-image";

export type BoatType = "Sail" | "Motor";

export type BoatEngineRole = "propulsion" | "generator" | "auxiliary";

export type BoatEngine = {
  /** Stable identifier. It must never be changed after the engine is created. */
  id: string;
  name: string;
  label: string;
  role: BoatEngineRole;
  archived?: boolean;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
};

export const defaultMainEngine = (): BoatEngine => ({
  id: "main-engine",
  name: "Main engine",
  label: "Main",
  role: "propulsion",
});

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

export type WindDriftTable = {
  windSpeedLimits: Record<WindDriftSailSetting, string>;
  rows: WindDriftTableRow[];
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

export function defaultWindDriftTable(): WindDriftTable {
  return {
    windSpeedLimits: { fullSail: "0", secondReef: "", stormSail: "" },
    rows: windDriftAngles.map((angle) => ({ angle, values: { fullSail: "", secondReef: "", stormSail: "" } })),
  };
}

function nonNegativeValue(value: string | undefined) {
  if (!value) return "";
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed < 0 ? "0" : value;
}

export function normalizeWindDriftTable(table: WindDriftTable | WindDriftTableRow[] = defaultWindDriftTable()): WindDriftTable {
  const windSpeedLimits = Array.isArray(table) ? defaultWindDriftTable().windSpeedLimits : table.windSpeedLimits;
  const rows = Array.isArray(table) ? table : table.rows;
  const rowsByAngle = new Map((rows ?? []).map((row) => [row.angle, row.values]));
  return {
    windSpeedLimits: {
      fullSail: "0",
      secondReef: nonNegativeValue(windSpeedLimits?.secondReef),
      stormSail: nonNegativeValue(windSpeedLimits?.stormSail),
    },
    rows: windDriftAngles.map((angle) => ({
      angle,
      values: {
        fullSail: nonNegativeValue(rowsByAngle.get(angle)?.fullSail),
        secondReef: nonNegativeValue(rowsByAngle.get(angle)?.secondReef),
        stormSail: nonNegativeValue(rowsByAngle.get(angle)?.stormSail),
      },
    })),
  };
}

export type Boat = {
  revision?: number;
  createdAt?: string;
  updatedAt?: string;
  id: string;
  archived?: boolean;
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
  windDriftTable?: WindDriftTable;
  engines?: BoatEngine[];
  image?: StoredImage;
  imageId?: string;
};

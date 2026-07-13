import type { StoredImage } from "./stored-image";

export type BoatType = "Sail" | "Motor";

export type DeviationTableRow = {
  heading: number;
  deviation: string;
};

export const deviationTableHeadings = Array.from({ length: 36 }, (_, index) => index * 10);

export function defaultDeviationTable(): DeviationTableRow[] {
  return deviationTableHeadings.map((heading) => ({ heading, deviation: "" }));
}

export function normalizeDeviationTable(rows: DeviationTableRow[] = []): DeviationTableRow[] {
  const rowsByHeading = new Map(rows.map((row) => [row.heading, row.deviation]));
  return deviationTableHeadings.map((heading) => ({ heading, deviation: rowsByHeading.get(heading) ?? "" }));
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
  image?: StoredImage;
};

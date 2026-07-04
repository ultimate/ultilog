import type { Boat, BoatType, CrewMember, LogLine, LogSheet } from "./logbook";

export type SheetForm = Pick<LogSheet, "title" | "dateRange" | "boatId" | "status"> & Pick<LogSheet["route"], "from" | "to"> & { fromTime: string; toTime: string };

export type BoatForm = Pick<Boat, "name" | "registration" | "flagState" | "homePort" | "owner" | "dimensions"> & {
  type: BoatType;
  manufacturer: string;
  mmsi: string;
  engine: string;
  safety: string;
  deviationTable: Boat["deviationTable"];
};

export type LineForm = Record<keyof LogLine, string>;

export type CrewForm = CrewMember;

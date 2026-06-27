import type { Boat, BoatType, CrewMember, LogLine, LogSheet } from "./logbook";

export type SheetForm = Pick<LogSheet, "title" | "dateRange" | "boatId"> & Pick<LogSheet["route"], "dayGoal" | "from" | "to"> & { fromTime: string; toTime: string };

export type BoatForm = Pick<Boat, "name" | "registration" | "flagState" | "homePort" | "owner" | "dimensions"> & {
  type: BoatType;
  manufacturer: string;
  mmsi: string;
  engine: string;
  safety: string;
  deviationTable: Boat["deviationTable"];
};

export type LineForm = Omit<Record<keyof LogLine, string>, "logNm" | "latitude" | "longitude"> & {
  latitude: string;
  longitude: string;
  logNm: string;
};

export type CrewForm = CrewMember;

import type { Boat, BoatType, CrewMember, LogLine, LogSheet } from "./logbook";

export type SheetForm = Pick<LogSheet, "title" | "dateRange" | "boatId" | "status" | "image"> & Pick<LogSheet["route"], "from" | "to"> & { fromTime: string; toTime: string; fromTimezone: string; toTimezone: string };

export type BoatForm = Pick<Boat, "name" | "registration" | "flagState" | "homePort" | "owner" | "dimensions" | "logfactor" | "image"> & {
  type: BoatType;
  manufacturer: string;
  mmsi: string;
  engine: string;
  safety: string;
  deviationTable: Boat["deviationTable"];
  windDriftTable: NonNullable<Boat["windDriftTable"]>;
};

export type LineForm = Record<keyof LogLine, string>;

export type CrewForm = CrewMember;

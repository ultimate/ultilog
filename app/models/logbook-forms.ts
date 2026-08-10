import type { Boat, BoatType, CrewMember, LogLine, LogSheet } from "./logbook";

export type SheetForm = Pick<LogSheet, "title" | "boatId" | "status" | "image"> & Pick<LogSheet["route"], "from" | "to"> & { fromDate: string; toDate: string; fromTime: string; toTime: string; fromTimezone: string; toTimezone: string };

export type BoatForm = Pick<Boat, "name" | "registration" | "flagState" | "homePort" | "owner" | "dimensions" | "logfactor" | "image"> & { engines: NonNullable<Boat["engines"]>;
  type: BoatType;
  manufacturer: string;
  mmsi: string;
  safety: string;
  deviationTable: Boat["deviationTable"];
  windDriftTable: NonNullable<Boat["windDriftTable"]>;
};

export type LineForm = Omit<Record<keyof LogLine, string>, "engineHours"> & { engineHours?: Record<string, string> };
export type LineFormField = Exclude<keyof LineForm, "engineHours" | "id">;

export type CrewForm = CrewMember;

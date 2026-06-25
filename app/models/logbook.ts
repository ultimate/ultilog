import type { Boat } from "./boat";
import type { LogSheet } from "./log-sheet";

export type PersistedLogbook = {
  boats: Boat[];
  sheets: LogSheet[];
};

export type { Boat, BoatType } from "./boat";
export type { CrewMember } from "./crew-member";
export type { LogLine } from "./log-line";
export type { LogSheet } from "./log-sheet";

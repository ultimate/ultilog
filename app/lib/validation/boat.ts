import type { Boat } from "../../models/logbook";
import { requireRevision, validatePersistedLogbook } from "./logbook";

export function validateBoat(value: unknown): Boat {
  return validatePersistedLogbook({ boats: [value], crewMembers: [], sheets: [] }).boats[0];
}

export function validateBoatUpdate(value: unknown): Boat {
  requireRevision(value);
  return validateBoat(value);
}

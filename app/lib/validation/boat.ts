import type { Boat } from "../../models/logbook";
import { validatePersistedLogbook } from "./logbook";

export function validateBoat(value: unknown): Boat {
  return validatePersistedLogbook({ boats: [value], crewMembers: [], sheets: [] }).boats[0];
}

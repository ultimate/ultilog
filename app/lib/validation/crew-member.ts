import type { CrewMember } from "../../models/logbook";
import { validatePersistedLogbook } from "./logbook";

export function validateCrewMember(value: unknown): CrewMember {
  return validatePersistedLogbook({ boats: [], crewMembers: [value], sheets: [] }).crewMembers[0];
}

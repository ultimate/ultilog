import type { CrewMember } from "../../models/logbook";
import { requireRevision, validatePersistedLogbook } from "./logbook";

export function validateCrewMember(value: unknown): CrewMember {
  return validatePersistedLogbook({ boats: [], crewMembers: [value], sheets: [] }).crewMembers[0];
}


export function validateCrewMemberUpdate(value: unknown): CrewMember {
  requireRevision(value);
  return validateCrewMember(value);
}

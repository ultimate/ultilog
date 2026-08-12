import { upsertCrewMember } from "../../../lib/logbook-store";
import { validateCrewMember } from "../../../lib/validation/crew-member";
import { ENTITY_REQUEST_LIMITS } from "../../../lib/validation/request-limits";
import { authenticatedMutation, jsonBody } from "../entity-route";

export const POST = (request: Request) => authenticatedMutation(async ownerId => upsertCrewMember(validateCrewMember(await jsonBody(request, ENTITY_REQUEST_LIMITS.crewMember)), ownerId));

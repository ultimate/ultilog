import { upsertCrewMember } from "../../../lib/logbook-store";
import { validateCrewMember } from "../../../lib/validation/crew-member";
import { authenticatedMutation, ENTITY_REQUEST_LIMITS, jsonBody } from "../entity-route";

export const POST = (request: Request) => authenticatedMutation(request, async ownerId => upsertCrewMember(validateCrewMember(await jsonBody(request, ENTITY_REQUEST_LIMITS.crew)), ownerId));

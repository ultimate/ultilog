import { upsertBoat } from "../../../lib/logbook-store";
import { validateBoat } from "../../../lib/validation/boat";
import { ENTITY_REQUEST_LIMITS } from "../../../lib/validation/request-limits";
import { authenticatedMutation, jsonBody } from "../entity-route";

export const POST = (request: Request) => authenticatedMutation(async ownerId => upsertBoat(validateBoat(await jsonBody(request, ENTITY_REQUEST_LIMITS.boat)), ownerId));

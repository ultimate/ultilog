import { upsertLogSheet } from "../../../lib/logbook-store";
import { validateLogSheet } from "../../../lib/validation/log-sheet";
import { ENTITY_REQUEST_LIMITS } from "../../../lib/validation/request-limits";
import { authenticatedMutation, jsonBody } from "../entity-route";

export const POST = (request: Request) => authenticatedMutation(async ownerId => upsertLogSheet(validateLogSheet(await jsonBody(request, ENTITY_REQUEST_LIMITS.sheet)), ownerId));

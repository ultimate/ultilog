import { upsertLogSheet } from "../../../lib/logbook-store";
import { validateFocusedLogSheet } from "../../../lib/validation/log-sheet";
import { authenticatedMutation, ENTITY_REQUEST_LIMITS, jsonBody } from "../entity-route";

export const POST = (request: Request) => authenticatedMutation(request, async ownerId => upsertLogSheet(validateFocusedLogSheet(await jsonBody(request, ENTITY_REQUEST_LIMITS.sheet)), ownerId));

import { upsertLogSheet } from "../../../lib/logbook-store";
import { validateLogSheet } from "../../../lib/validation/log-sheet";
import { authenticatedMutation, jsonBody } from "../entity-route";

export const POST = (request: Request) => authenticatedMutation(async ownerId => upsertLogSheet(validateLogSheet(await jsonBody(request)), ownerId));

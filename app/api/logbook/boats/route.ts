import { upsertBoat } from "../../../lib/logbook-store";
import { validateBoat } from "../../../lib/validation/boat";
import { authenticatedMutation, jsonBody } from "../entity-route";

export const POST = (request: Request) => authenticatedMutation(async ownerId => upsertBoat(validateBoat(await jsonBody(request)), ownerId));

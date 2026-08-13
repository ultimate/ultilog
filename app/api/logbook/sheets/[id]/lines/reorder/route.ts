import { reorderLogLines } from "../../../../../../lib/logbook-store";
import { validateLineOrder } from "../../../../../../lib/validation/log-line";
import { authenticatedMutation, ENTITY_REQUEST_LIMITS, jsonBody } from "../../../../entity-route";

type Context = { params: Promise<{ id: string }> };
export const PUT = (request: Request, context: Context) => authenticatedMutation(request, async ownerId => reorderLogLines((await context.params).id, validateLineOrder(await jsonBody(request, ENTITY_REQUEST_LIMITS.lineOrder)), ownerId));

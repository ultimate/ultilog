import { reorderLogLines } from "../../../../../../lib/logbook-store";
import { validateLineOrder } from "../../../../../../lib/validation/log-line";
import { authenticatedMutation, jsonBody } from "../../../../entity-route";

type Context = { params: Promise<{ id: string }> };
export const PUT = (request: Request, context: Context) => authenticatedMutation(async ownerId => reorderLogLines((await context.params).id, validateLineOrder(await jsonBody(request)), ownerId));

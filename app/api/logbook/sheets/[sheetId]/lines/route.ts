import { createLogLine } from "../../../../../lib/logbook-store";
import { validateLogLine } from "../../../../../lib/validation/log-line";
import { authenticatedMutation, jsonBody } from "../../../entity-route";

type Context = { params: Promise<{ sheetId: string }> };
export const POST = (request: Request, context: Context) => authenticatedMutation(async ownerId => createLogLine((await context.params).sheetId, validateLogLine(await jsonBody(request)), ownerId));

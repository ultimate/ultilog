import { deleteLogSheet, upsertLogSheet } from "../../../../lib/logbook-store";
import { validateLogSheet } from "../../../../lib/validation/log-sheet";
import { ENTITY_REQUEST_LIMITS } from "../../../../lib/validation/request-limits";
import { authenticatedMutation, jsonBody } from "../../entity-route";

type Context = { params: Promise<{ id: string }> };
export const PUT = (request: Request, context: Context) => authenticatedMutation(async ownerId => {
  const { id } = await context.params; const sheet = validateLogSheet(await jsonBody(request, ENTITY_REQUEST_LIMITS.sheet));
  if (sheet.id !== id) throw new SyntaxError("Route and entity ids differ");
  return upsertLogSheet(sheet, ownerId);
});
export const DELETE = (_request: Request, context: Context) => authenticatedMutation(async ownerId => deleteLogSheet((await context.params).id, ownerId));

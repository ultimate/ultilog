import { deleteLogSheet, upsertLogSheet } from "../../../../lib/logbook-store";
import { validateFocusedLogSheet } from "../../../../lib/validation/log-sheet";
import { authenticatedMutation, ENTITY_REQUEST_LIMITS, jsonBody } from "../../entity-route";

type Context = { params: Promise<{ id: string }> };
export const PUT = (request: Request, context: Context) => authenticatedMutation(async ownerId => {
  const { id } = await context.params; const sheet = validateFocusedLogSheet(await jsonBody(request, ENTITY_REQUEST_LIMITS.sheet));
  if (sheet.id !== id) throw new SyntaxError("Route and entity ids differ");
  return upsertLogSheet(sheet, ownerId);
});
export const DELETE = (_request: Request, context: Context) => authenticatedMutation(async ownerId => deleteLogSheet((await context.params).id, ownerId));

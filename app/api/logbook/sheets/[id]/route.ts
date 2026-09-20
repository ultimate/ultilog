import { deleteLogSheet, upsertLogSheet } from "../../../../lib/logbook-store";
import { verifyUserPassword } from "../../../../lib/users";
import { validateFocusedLogSheetUpdate } from "../../../../lib/validation/log-sheet";
import { authenticatedMutation, deleteConfirmation, ENTITY_REQUEST_LIMITS, jsonBody } from "../../entity-route";

type Context = { params: Promise<{ id: string }> };
export const PUT = (request: Request, context: Context) => authenticatedMutation(request, async ownerId => {
  const { id } = await context.params; const sheet = validateFocusedLogSheetUpdate(await jsonBody(request, ENTITY_REQUEST_LIMITS.sheet));
  if (sheet.id !== id) throw new SyntaxError("Route and entity ids differ");
  return upsertLogSheet(sheet, ownerId);
});
export const DELETE = (request: Request, context: Context) => authenticatedMutation(request, async ownerId => {
  const { revision, password } = await deleteConfirmation(request);
  if (!password || !await verifyUserPassword(ownerId, password)) {
    throw Object.assign(new Error("Current password is incorrect."), { code: "invalid_password" });
  }
  return deleteLogSheet((await context.params).id, revision, ownerId);
});

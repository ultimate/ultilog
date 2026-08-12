import { deleteLogLine, updateLogLine } from "../../../../../../lib/logbook-store";
import { validateLogLineUpdate } from "../../../../../../lib/validation/log-line";
import { authenticatedMutation, deleteRevision, ENTITY_REQUEST_LIMITS, jsonBody } from "../../../../entity-route";

type Context = { params: Promise<{ id: string; lineId: string }> };
export const PUT = (request: Request, context: Context) => authenticatedMutation(async ownerId => {
  const { id, lineId } = await context.params;
  const line = validateLogLineUpdate(await jsonBody(request, ENTITY_REQUEST_LIMITS.line));
  if (line.id !== lineId) throw new SyntaxError("Route and entity ids differ");
  return updateLogLine(id, lineId, line, ownerId);
});
export const DELETE = (request: Request, context: Context) => authenticatedMutation(async ownerId => { const { id, lineId } = await context.params; return deleteLogLine(id, lineId, await deleteRevision(request), ownerId); });

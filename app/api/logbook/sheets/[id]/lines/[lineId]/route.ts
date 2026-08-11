import { deleteLogLine, updateLogLine } from "../../../../../../lib/logbook-store";
import { validateLogLine } from "../../../../../../lib/validation/log-line";
import { authenticatedMutation, jsonBody } from "../../../../entity-route";

type Context = { params: Promise<{ id: string; lineId: string }> };
export const PUT = (request: Request, context: Context) => authenticatedMutation(async ownerId => {
  const { id, lineId } = await context.params;
  const line = validateLogLine(await jsonBody(request));
  if (line.id !== lineId) throw new SyntaxError("Route and entity ids differ");
  return updateLogLine(id, lineId, line, ownerId);
});
export const DELETE = (_request: Request, context: Context) => authenticatedMutation(async ownerId => { const { id, lineId } = await context.params; return deleteLogLine(id, lineId, ownerId); });

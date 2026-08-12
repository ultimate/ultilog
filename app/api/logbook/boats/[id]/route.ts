import { deleteBoat, upsertBoat } from "../../../../lib/logbook-store";
import { validateBoatUpdate } from "../../../../lib/validation/boat";
import { authenticatedMutation, deleteRevision, ENTITY_REQUEST_LIMITS, jsonBody } from "../../entity-route";

type Context = { params: Promise<{ id: string }> };
export const PUT = (request: Request, context: Context) => authenticatedMutation(async ownerId => {
  const { id } = await context.params; const boat = validateBoatUpdate(await jsonBody(request, ENTITY_REQUEST_LIMITS.boat));
  if (boat.id !== id) throw new SyntaxError("Route and entity ids differ");
  return upsertBoat(boat, ownerId);
});
export const DELETE = (request: Request, context: Context) => authenticatedMutation(async ownerId => deleteBoat((await context.params).id, await deleteRevision(request), ownerId));

import { deleteBoat, upsertBoat } from "../../../../lib/logbook-store";
import { validateBoat } from "../../../../lib/validation/boat";
import { ENTITY_REQUEST_LIMITS } from "../../../../lib/validation/request-limits";
import { authenticatedMutation, jsonBody } from "../../entity-route";

type Context = { params: Promise<{ id: string }> };
export const PUT = (request: Request, context: Context) => authenticatedMutation(async ownerId => {
  const { id } = await context.params; const boat = validateBoat(await jsonBody(request, ENTITY_REQUEST_LIMITS.boat));
  if (boat.id !== id) throw new SyntaxError("Route and entity ids differ");
  return upsertBoat(boat, ownerId);
});
export const DELETE = (_request: Request, context: Context) => authenticatedMutation(async ownerId => deleteBoat((await context.params).id, ownerId));

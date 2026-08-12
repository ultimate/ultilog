import { deleteCrewMember, upsertCrewMember } from "../../../../lib/logbook-store";
import { validateCrewMemberUpdate } from "../../../../lib/validation/crew-member";
import { authenticatedMutation, ENTITY_REQUEST_LIMITS, jsonBody } from "../../entity-route";

type Context = { params: Promise<{ id: string }> };
export const PUT = (request: Request, context: Context) => authenticatedMutation(async ownerId => {
  const { id } = await context.params; const crew = validateCrewMemberUpdate(await jsonBody(request, ENTITY_REQUEST_LIMITS.crew));
  if (crew.id !== id) throw new SyntaxError("Route and entity ids differ");
  return upsertCrewMember(crew, ownerId);
});
export const DELETE = (_request: Request, context: Context) => authenticatedMutation(async ownerId => deleteCrewMember((await context.params).id, ownerId));

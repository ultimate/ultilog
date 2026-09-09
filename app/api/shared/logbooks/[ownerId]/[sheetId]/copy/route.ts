import { copySharedLogSheet } from "../../../../../../lib/logbook-store";
import { authenticatedMutation, jsonBody } from "../../../../../logbook/entity-route";

type Context = { params: Promise<{ ownerId: string; sheetId: string }> };

export const POST = (request: Request, context: Context) => authenticatedMutation(request, async requesterId => {
  const body = validateOptions(await jsonBody(request, 4 * 1024));
  const { ownerId, sheetId } = await context.params;
  const copied = await copySharedLogSheet(ownerId, sheetId, body, requesterId);
  return copied ? { id: copied.id } : undefined;
});

function validateOptions(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new SyntaxError("A copy options object is required.");
  const input = value as Record<string, unknown>;
  const allowed = new Set(["destinationBoatId", "includeCrew", "includePicture"]);
  if (Object.keys(input).some(key => !allowed.has(key))) throw new SyntaxError("Only destination copy options are accepted.");
  if (typeof input.destinationBoatId !== "string" || !input.destinationBoatId.trim()) throw new SyntaxError("destinationBoatId is required.");
  if (input.includeCrew !== undefined && typeof input.includeCrew !== "boolean") throw new SyntaxError("includeCrew must be a boolean.");
  if (input.includePicture !== undefined && typeof input.includePicture !== "boolean") throw new SyntaxError("includePicture must be a boolean.");
  return { destinationBoatId: input.destinationBoatId, ...(input.includeCrew === undefined ? {} : { includeCrew: input.includeCrew }), ...(input.includePicture === undefined ? {} : { includePicture: input.includePicture }) };
}

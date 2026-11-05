import { copySharedLogSheet, previewSharedLogSheetCopies } from "../../../../../../lib/logbook-store";
import { authenticatedMutation, jsonBody } from "../../../../../logbook/entity-route";

import { auth } from "../../../../../../../auth";
import { NextResponse } from "next/server";

type Context = { params: Promise<{ ownerId: string; sheetId: string }> };

export async function GET(_request: Request, context: Context) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { ownerId, sheetId } = await context.params;
  try {
    const preview = await previewSharedLogSheetCopies(ownerId, sheetId, session.user.id);
    return NextResponse.json(preview ?? { error: "Not found" }, { status: preview ? 200 : 404, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "shared_sections_not_visible") return NextResponse.json({ error: "Copy forbidden", code: error.code }, { status: 403 });
    throw error;
  }
}

export const POST = (request: Request, context: Context) => authenticatedMutation(request, async requesterId => {
  const body = validateOptions(await jsonBody(request, 4 * 1024));
  const { ownerId, sheetId } = await context.params;
  const copied = await copySharedLogSheet(ownerId, sheetId, body, requesterId);
  return copied ? { id: copied.id } : undefined;
});

function validateOptions(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new SyntaxError("A copy options object is required.");
  const input = value as Record<string, unknown>;
  const allowed = new Set(["destinationBoatId", "includeCrew", "includePicture", "allowDuplicate", "action", "targetCopyId", "expectedRevision", "expectedContentVersion"]);
  if (Object.keys(input).some(key => !allowed.has(key))) throw new SyntaxError("Only destination copy options are accepted.");
  if (input.action !== undefined && input.action !== "create" && input.action !== "update") throw new SyntaxError("Invalid copy action.");
  if (input.action === "update") {
    if (typeof input.targetCopyId !== "string" || !input.targetCopyId.trim()) throw new SyntaxError("targetCopyId is required.");
    if (!Number.isSafeInteger(input.expectedRevision) || Number(input.expectedRevision) <= 0) throw new SyntaxError("expectedRevision is required.");
    if (typeof input.expectedContentVersion !== "string" || !/^[a-f0-9]{64}$/.test(input.expectedContentVersion)) throw new SyntaxError("expectedContentVersion is required.");
  } else if (["targetCopyId", "expectedRevision", "expectedContentVersion"].some(key => input[key] !== undefined)) throw new SyntaxError("Update options require the update action.");
  if (typeof input.destinationBoatId !== "string" || !input.destinationBoatId.trim()) throw new SyntaxError("destinationBoatId is required.");
  if (input.includeCrew !== undefined && typeof input.includeCrew !== "boolean") throw new SyntaxError("includeCrew must be a boolean.");
  if (input.includePicture !== undefined && typeof input.includePicture !== "boolean") throw new SyntaxError("includePicture must be a boolean.");
  if (input.allowDuplicate !== undefined && typeof input.allowDuplicate !== "boolean") throw new SyntaxError("allowDuplicate must be a boolean.");
  return { ...(input.action === undefined ? {} : { action: input.action as "create" | "update" }), ...(input.action === "update" ? { targetCopyId: input.targetCopyId as string, expectedRevision: input.expectedRevision as number, expectedContentVersion: input.expectedContentVersion as string } : {}), destinationBoatId: input.destinationBoatId, ...(input.includeCrew === undefined ? {} : { includeCrew: input.includeCrew }), ...(input.includePicture === undefined ? {} : { includePicture: input.includePicture }), ...(input.allowDuplicate === undefined ? {} : { allowDuplicate: input.allowDuplicate }) };
}

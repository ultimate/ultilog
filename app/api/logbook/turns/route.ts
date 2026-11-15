import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { readLogbook } from "../../../lib/logbook-store";
import { mutateTurns } from "../../../lib/logbook-store";
import { authenticatedMutation, jsonBody } from "../entity-route";
import type { TurnAction } from "../../../models/turn";
export const PUT = (request: Request) =>
  authenticatedMutation(request, async (ownerId) => {
    const body = await jsonBody(request, 256 * 1024);
    if (
      !body ||
      !Number.isSafeInteger(body.revision) ||
      body.revision < 1 ||
      !body.operation ||
      typeof body.operation !== "object"
    )
      throw new SyntaxError("A revision and turn operation are required.");
    const operation = body.operation;
    if (
      !["rename", "split", "boundary", "merge", "dismiss", "correct"].includes(
        operation.action,
      )
    )
      throw new SyntaxError("Unknown turn operation.");
    if (
      ["rename", "split", "boundary", "merge"].includes(operation.action) &&
      typeof operation.turnId !== "string"
    )
      throw new SyntaxError("Turn id is required.");
    if (
      ["rename", "merge"].includes(operation.action) &&
      (typeof operation.name !== "string" ||
        (operation.automatic !== undefined &&
          typeof operation.automatic !== "boolean"))
    )
      throw new SyntaxError("A name and valid naming mode are required.");
    if (
      (["split", "boundary"].includes(operation.action) &&
        typeof operation.at !== "string") ||
      (operation.action === "merge" && typeof operation.nextId !== "string") ||
      (operation.action === "dismiss" && typeof operation.key !== "string") ||
      (operation.action === "correct" &&
        (typeof operation.sheetId !== "string" ||
          !Array.isArray(operation.portions) ||
          operation.portions.some(
            (portion: unknown) => !portion || typeof portion !== "object",
          )))
    )
      throw new SyntaxError("Malformed turn operation.");
    return mutateTurns(body.revision, operation as TurnAction, ownerId);
  });

export async function GET() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const logbook = await readLogbook(session.user.id);
  return NextResponse.json(logbook.turnState);
}

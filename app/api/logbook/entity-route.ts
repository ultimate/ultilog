import { NextResponse } from "next/server";
import { auth } from "../../../auth";
import { LogbookValidationError } from "../../lib/validation/logbook";

export async function authenticatedMutation<T>(operation: (ownerId: string) => Promise<T>) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const entity = await operation(session.user.id);
    if (!entity) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(entity);
  } catch (error) {
    if (error instanceof LogbookValidationError || error instanceof SyntaxError) return NextResponse.json({ error: "Invalid entity payload" }, { status: 400 });
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : undefined;
    if (["referenced_boat_deleted", "missing_boat", "archived_boat_for_new_sheet", "missing_image", "referenced_image"].includes(code ?? "")) return NextResponse.json({ error: error instanceof Error ? error.message : "Mutation rejected", code }, { status: 409 });
    throw error;
  }
}

export async function jsonBody(request: Request) { return JSON.parse(await request.text()); }

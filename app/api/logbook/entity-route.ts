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
    if (error instanceof RequestBodyTooLargeError) return NextResponse.json({ error: error.message, code: "request_body_too_large" }, { status: 413 });
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : undefined;
    if (code === "invalid_revision") return NextResponse.json({ error: "Invalid entity revision", code }, { status: 400 });
    if (error instanceof LogbookValidationError || error instanceof SyntaxError) return NextResponse.json({ error: "Invalid entity payload", code: "invalid_payload" }, { status: 400 });
    if (["revision_conflict", "referenced_boat_deleted", "missing_boat", "archived_boat_for_new_sheet", "missing_image", "referenced_image"].includes(code ?? "")) return NextResponse.json({ error: error instanceof Error ? error.message : "Mutation rejected", code }, { status: 409 });
    throw error;
  }
}

export const ENTITY_REQUEST_LIMITS = {
  boat: envBytes("LOGBOOK_BOAT_REQUEST_BYTES", 64 * 1024),
  crew: envBytes("LOGBOOK_CREW_REQUEST_BYTES", 32 * 1024),
  sheet: envBytes("LOGBOOK_SHEET_REQUEST_BYTES", 128 * 1024),
  line: envBytes("LOGBOOK_LINE_REQUEST_BYTES", 32 * 1024),
  lineOrder: envBytes("LOGBOOK_LINE_REORDER_REQUEST_BYTES", 256 * 1024),
} as const;

class RequestBodyTooLargeError extends Error {}

export async function jsonBody(request: Request, byteLimit: number) {
  const declared = request.headers.get("content-length");
  if (declared !== null && /^\d+$/.test(declared) && Number(declared) > byteLimit) throw new RequestBodyTooLargeError("Request body exceeds the endpoint byte limit.");
  const body = await request.text();
  if (Buffer.byteLength(body, "utf8") > byteLimit) throw new RequestBodyTooLargeError("Request body exceeds the endpoint byte limit.");
  return JSON.parse(body);
}

export async function deleteRevision(request: Request) {
  let body: unknown;
  try {
    body = await jsonBody(request, 1024);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) throw error;
    throw Object.assign(new Error("A positive integer revision is required."), { code: "invalid_revision" });
  }
  const revision = body && typeof body === "object" && !Array.isArray(body) ? (body as { revision?: unknown }).revision : undefined;
  if (!Number.isSafeInteger(revision) || Number(revision) <= 0) {
    throw Object.assign(new Error("A positive integer revision is required."), { code: "invalid_revision" });
  }
  return revision as number;
}

function envBytes(name: string, fallback: number) {
  const configured = Number(process.env[name]);
  return Number.isSafeInteger(configured) && configured > 0 ? configured : fallback;
}

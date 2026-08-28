import { NextResponse } from "next/server";
import { auth } from "../../../auth";
import { LogbookValidationError } from "../../lib/validation/logbook";
import { guardMutationOrigin } from "../../lib/security/request-origin";

export async function authenticatedMutation<T>(request: Request, operation: (ownerId: string) => Promise<T>) {
  const originError = guardMutationOrigin(request);
  if (originError) return originError;
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
    if (error instanceof LogbookValidationError && error.kind === "limit") return NextResponse.json({ error: error.message, code: error.code ?? "entity_count_limit_exceeded" }, { status: 413 });
    if (error instanceof LogbookValidationError || error instanceof SyntaxError) return NextResponse.json({ error: error.message, code: "invalid_payload" }, { status: 400 });
    if (["revision_conflict", "referenced_boat_deleted", "missing_boat", "archived_boat_for_new_sheet", "missing_image", "referenced_image"].includes(code ?? "")) return NextResponse.json({ error: error instanceof Error ? error.message : "Mutation rejected", code }, { status: 409 });
    const reference = crypto.randomUUID();
    console.error(`[logbook-mutation:${reference}]`, error);
    return NextResponse.json({
      error: databaseErrorMessage(code),
      code: code ? `database_${code}` : "internal_mutation_error",
      reference,
    }, { status: 500 });
  }
}

function databaseErrorMessage(code?: string) {
  if (code === "22001") return "A value is too long for its database column.";
  if (code === "23502") return "A required database value is missing.";
  if (code === "23503") return "The change refers to a database record that does not exist.";
  if (code === "23505") return "The change conflicts with an existing database record.";
  if (code === "23514") return "A value does not satisfy a database constraint.";
  return "An unexpected server error occurred while saving. Check the server log using the supplied reference.";
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

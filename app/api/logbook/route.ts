import { NextResponse } from "next/server";
import { auth } from "../../../auth";
import { readLogbook, writeLogbook } from "../../lib/logbook-store";
import { applyDemoLogbookRestrictions } from "../../lib/demo/demo-logbook-policy";
import { isActiveDemoSandbox } from "../../lib/demo/demo-policy";
import { validateLogbookMutation } from "../../domain/boats/boat-policy";
import { LOGBOOK_LIMITS, LogbookValidationError, validatePersistedLogbook } from "../../lib/validation/logbook";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await readLogbook(session.user.id));
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const configuredByteLimit = Number(process.env.LOGBOOK_IMPORT_REQUEST_BYTES ?? process.env.LOGBOOK_MAX_REQUEST_BYTES);
  const byteLimit = Number.isFinite(configuredByteLimit) && configuredByteLimit > 0 ? configuredByteLimit : LOGBOOK_LIMITS.requestBytes;
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > byteLimit) return NextResponse.json({ error: "Logbook payload is too large", code: "request_body_too_large" }, { status: 413 });
  const body = await request.text().catch(() => "");
  if (Buffer.byteLength(body, "utf8") > byteLimit) return NextResponse.json({ error: "Logbook payload is too large", code: "request_body_too_large" }, { status: 413 });
  let logbook;
  try { logbook = validatePersistedLogbook(JSON.parse(body)); }
  catch (error) {
    const status = error instanceof LogbookValidationError && error.kind === "limit" ? 413 : 400;
    const message = error instanceof LogbookValidationError && error.kind === "limit" ? error.message : "Invalid logbook payload";
    return NextResponse.json({ error: message }, { status });
  }
  const persistedLogbook = await isActiveDemoSandbox(session.user.id) ? applyDemoLogbookRestrictions(logbook) : logbook;
  const currentLogbook = await readLogbook(session.user.id);
  const mutationError = validateLogbookMutation(currentLogbook, persistedLogbook);
  if (mutationError) return NextResponse.json({ error: mutationError.message, code: mutationError.code }, { status: 409 });
  return NextResponse.json(await writeLogbook(persistedLogbook, session.user.id));
}

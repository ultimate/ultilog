import { NextResponse } from "next/server";
import { auth } from "../../../auth";
import { readLogbook, writeLogbook } from "../../lib/logbook-store";
import type { PersistedLogbook } from "../../models/logbook";
import { applyDemoLogbookRestrictions } from "../../lib/demo/demo-logbook-policy";
import { isActiveDemoSandbox } from "../../lib/demo/demo-policy";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await readLogbook(session.user.id));
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const logbook = await request.json() as PersistedLogbook;
  if (!Array.isArray(logbook.boats) || !Array.isArray(logbook.crewMembers) || !Array.isArray(logbook.sheets)) {
    return NextResponse.json({ error: "Invalid logbook payload" }, { status: 400 });
  }
  const persistedLogbook = await isActiveDemoSandbox(session.user.id) ? applyDemoLogbookRestrictions(logbook) : logbook;
  return NextResponse.json(await writeLogbook(persistedLogbook, session.user.id));
}

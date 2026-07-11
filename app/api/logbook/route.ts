import { NextResponse } from "next/server";
import { auth } from "../../../auth";
import { readLogbook, writeLogbook } from "../../lib/logbook-store";
import type { PersistedLogbook } from "../../models/logbook";

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
  return NextResponse.json(await writeLogbook(logbook, session.user.id));
}

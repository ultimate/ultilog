import { NextResponse } from "next/server";
import { readLogbook, writeLogbook } from "../../lib/logbook-store";
import type { PersistedLogbook } from "../../models/logbook";

export async function GET() {
  return NextResponse.json(await readLogbook());
}

export async function PUT(request: Request) {
  const logbook = await request.json() as PersistedLogbook;
  if (!Array.isArray(logbook.boats) || !Array.isArray(logbook.sheets)) {
    return NextResponse.json({ error: "Invalid logbook payload" }, { status: 400 });
  }
  return NextResponse.json(await writeLogbook(logbook));
}

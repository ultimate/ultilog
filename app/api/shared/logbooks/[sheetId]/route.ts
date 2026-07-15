import { NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { readSharedLogSheet } from "../../../../lib/logbook-store";

export async function GET(_request: Request, { params }: { params: Promise<{ sheetId: string }> }) {
  const { sheetId } = await params;
  const session = await auth();
  const sharedSheet = await readSharedLogSheet(sheetId, Boolean(session?.user?.id));
  if (!sharedSheet) return NextResponse.json({ error: "Shared logbook not found" }, { status: 404 });
  return NextResponse.json(sharedSheet);
}

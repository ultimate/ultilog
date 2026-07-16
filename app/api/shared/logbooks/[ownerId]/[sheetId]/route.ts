import { NextResponse } from "next/server";
import { auth } from "../../../../../../auth";
import { readSharedLogSheet } from "../../../../../lib/logbook-store";

export async function GET(_request: Request, { params }: { params: Promise<{ ownerId: string; sheetId: string }> }) {
  const { ownerId, sheetId } = await params;
  const session = await auth();
  const sharedSheet = await readSharedLogSheet(sheetId, Boolean(session?.user?.id), ownerId);
  if (!sharedSheet) return NextResponse.json({ error: "Shared logbook not found" }, { status: 404 });
  return NextResponse.json(sharedSheet);
}

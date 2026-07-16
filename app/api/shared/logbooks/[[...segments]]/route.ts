import { NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { readSharedLogSheet } from "../../../../lib/logbook-store";

export async function GET(_request: Request, { params }: { params: Promise<{ segments?: string[] }> }) {
  const { segments = [] } = await params;
  const { ownerId, sheetId } = parseShareSegments(segments);
  if (!sheetId) return NextResponse.json({ error: "Shared logbook not found" }, { status: 404 });

  const session = await auth();
  const sharedSheet = await readSharedLogSheet(sheetId, Boolean(session?.user?.id), ownerId);
  if (!sharedSheet) return NextResponse.json({ error: "Shared logbook not found" }, { status: 404 });
  return NextResponse.json(sharedSheet);
}

function parseShareSegments(segments: string[]) {
  if (segments.length === 1) return { sheetId: segments[0] };
  if (segments.length === 2) return { ownerId: segments[0], sheetId: segments[1] };
  return {};
}

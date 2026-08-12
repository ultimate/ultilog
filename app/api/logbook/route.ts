import { NextResponse } from "next/server";
import { auth } from "../../../auth";
import { readLogbook } from "../../lib/logbook-store";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await readLogbook(session.user.id));
}

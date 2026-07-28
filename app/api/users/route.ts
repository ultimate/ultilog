import { NextResponse } from "next/server";
import { auth } from "../../../auth";
import { listUsersForDirectory } from "../../lib/users";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ users: await listUsersForDirectory() });
}

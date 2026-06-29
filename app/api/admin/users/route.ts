import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { listKnownGroups, listUsersForAdmin, updateUserGroups, userHasGroup } from "../../../lib/users";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!await userHasGroup(session.user.id, "admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ users: await listUsersForAdmin(), groups: await listKnownGroups() });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!await userHasGroup(session.user.id, "admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const body = await request.json() as { userId?: string; groups?: string[] };
    if (!body.userId) return NextResponse.json({ error: "User is required." }, { status: 400 });
    const groups = Array.isArray(body.groups) ? body.groups : [];
    if (body.userId === session.user.id && !groups.map((group) => group.trim().toLowerCase()).includes("admin")) {
      return NextResponse.json({ error: "You cannot remove the admin group from your own account." }, { status: 400 });
    }
    const user = await updateUserGroups(body.userId, groups);
    return NextResponse.json({ user, groups: await listKnownGroups() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update groups." }, { status: 400 });
  }
}

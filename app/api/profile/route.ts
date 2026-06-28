import { NextResponse } from "next/server";
import { auth } from "../../../auth";
import { updateUserEmail, updateUserPassword } from "../../lib/users";

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json() as { action?: string; email?: string; currentPassword?: string; newPassword?: string };
    if (body.action === "email") {
      const user = await updateUserEmail(session.user.id, { email: body.email ?? "", currentPassword: body.currentPassword ?? "" });
      return NextResponse.json({ email: user.email });
    }
    if (body.action === "password") {
      await updateUserPassword(session.user.id, { currentPassword: body.currentPassword ?? "", newPassword: body.newPassword ?? "" });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unsupported profile update." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update profile." }, { status: 400 });
  }
}

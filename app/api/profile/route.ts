import { NextResponse } from "next/server";
import { auth } from "../../../auth";
import { deleteUserAccount, findUserById, updateUserEmail, updateUserName, updateUserOnboardingCompletedTasks, updateUserPassword, updateUserViewPreferences } from "../../lib/users";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await findUserById(session.user.id);
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });
  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    groups: user.groups,
    onboardingCompletedTasks: user.onboardingCompletedTasks,
    theme: user.theme,
    isNavSlim: user.isNavSlim,
  });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json() as { action?: string; name?: string; email?: string; currentPassword?: string; newPassword?: string; onboardingCompletedTasks?: unknown; theme?: unknown; isNavSlim?: unknown };
    if (body.action === "name") {
      const user = await updateUserName(session.user.id, { name: body.name ?? "", currentPassword: body.currentPassword ?? "" });
      return NextResponse.json({ name: user.name });
    }
    if (body.action === "email") {
      const user = await updateUserEmail(session.user.id, { email: body.email ?? "", currentPassword: body.currentPassword ?? "" });
      return NextResponse.json({ email: user.email });
    }
    if (body.action === "password") {
      await updateUserPassword(session.user.id, { currentPassword: body.currentPassword ?? "", newPassword: body.newPassword ?? "" });
      return NextResponse.json({ ok: true });
    }
    if (body.action === "onboarding") {
      const user = await updateUserOnboardingCompletedTasks(session.user.id, body.onboardingCompletedTasks);
      return NextResponse.json({ onboardingCompletedTasks: user.onboardingCompletedTasks });
    }
    if (body.action === "preferences") {
      const user = await updateUserViewPreferences(session.user.id, { theme: body.theme, isNavSlim: body.isNavSlim });
      return NextResponse.json({ theme: user.theme, isNavSlim: user.isNavSlim });
    }
    return NextResponse.json({ error: "Unsupported profile update." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update profile." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json() as { currentPassword?: string };
    await deleteUserAccount(session.user.id, { currentPassword: body.currentPassword ?? "" });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to delete account." }, { status: 400 });
  }
}

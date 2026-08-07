import { NextResponse } from "next/server";
import { auth } from "../../../auth";
import { deleteUserAccount, findUserById, removeUserAvatar, updateUserAvatar, updateUserComplianceRead, updateUserEmail, updateUserName, updateUserOnboardingCompletedTasks, updateUserPassword, updateUserViewPreferences } from "../../lib/users";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await findUserById(session.user.id);
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });
  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    avatar: user.avatar,
    hasUploadedAvatar: user.hasUploadedAvatar,
    groups: user.groups,
    onboardingCompletedTasks: user.onboardingCompletedTasks,
    preferences: {
      countryCode: user.countryCode,
      language: user.language,
      windUnit: user.windUnit,
      waterHeightUnit: user.waterHeightUnit,
      temperatureUnit: user.temperatureUnit,
      coordinateFormat: user.coordinateFormat,
      distanceDisplayUnit: user.distanceDisplayUnit,
      defaultBoatId: user.defaultBoatId,
      defaultCrewMemberIds: user.defaultCrewMemberIds,
      theme: user.theme,
      isNavSlim: user.isNavSlim,
      showCourseConversionTable: user.showCourseConversionTable,
      showAvatarOnPrint: user.showAvatarOnPrint,
    },
    theme: user.theme,
    isNavSlim: user.isNavSlim,
    hasReadCompliance: user.hasReadCompliance,
  });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json() as { action?: string; name?: string; email?: string; avatarData?: string; avatarMimeType?: string; currentPassword?: string; newPassword?: string; onboardingCompletedTasks?: unknown; preferences?: Record<string, unknown>; theme?: unknown; isNavSlim?: unknown; showCourseConversionTable?: unknown; showAvatarOnPrint?: unknown };
    if (body.action === "avatar") {
      const avatar = await updateUserAvatar(session.user.id, { data: body.avatarData ?? "", mimeType: body.avatarMimeType ?? "" });
      return NextResponse.json({ avatar, hasUploadedAvatar: true });
    }
    if (body.action === "avatar-remove") {
      const avatar = await removeUserAvatar(session.user.id);
      return NextResponse.json({ avatar, hasUploadedAvatar: false });
    }
    if (body.action === "name") {
      const user = await updateUserName(session.user.id, { name: body.name ?? "", currentPassword: body.currentPassword ?? "" });
      return NextResponse.json({ name: user.name });
    }
    if (body.action === "email") {
      const user = await updateUserEmail(session.user.id, { email: body.email ?? "", currentPassword: body.currentPassword ?? "" });
      return NextResponse.json({ email: user.email, emailVerified: user.emailVerified });
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
      const preferencesInput = body.preferences ?? body;
      const user = await updateUserViewPreferences(session.user.id, preferencesInput);
      return NextResponse.json({
        preferences: {
          countryCode: user.countryCode,
          language: user.language,
          windUnit: user.windUnit,
          waterHeightUnit: user.waterHeightUnit,
          temperatureUnit: user.temperatureUnit,
          coordinateFormat: user.coordinateFormat,
          distanceDisplayUnit: user.distanceDisplayUnit,
          defaultBoatId: user.defaultBoatId,
          defaultCrewMemberIds: user.defaultCrewMemberIds,
          theme: user.theme,
          isNavSlim: user.isNavSlim,
          showCourseConversionTable: user.showCourseConversionTable,
          showAvatarOnPrint: user.showAvatarOnPrint,
        },
        theme: user.theme,
        isNavSlim: user.isNavSlim,
      });
    }
    if (body.action === "compliance-read") {
      const user = await updateUserComplianceRead(session.user.id);
      return NextResponse.json({ hasReadCompliance: user.hasReadCompliance });
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

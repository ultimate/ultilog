import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

vi.mock("../../../auth", () => ({
  auth: vi.fn(),
}));

vi.mock("../../../app/lib/users", () => ({
  deleteUserAccount: vi.fn(),
  findUserById: vi.fn(),
  removeUserAvatar: vi.fn(),
  updateUserComplianceRead: vi.fn(),
  updateUserEmail: vi.fn(),
  updateUserName: vi.fn(),
  updateUserOnboardingCompletedTasks: vi.fn(),
  updateUserPassword: vi.fn(),
  updateUserViewPreferences: vi.fn(),
}));

const { auth } = await import("../../../auth");
const users = await import("../../../app/lib/users");
const { DELETE, GET, PATCH } = await import("../../../app/api/profile/route");

const mockedAuth = auth as unknown as Mock;
const mockedDeleteUserAccount = vi.mocked(users.deleteUserAccount);
const mockedFindUserById = vi.mocked(users.findUserById);
const mockedRemoveUserAvatar = vi.mocked(users.removeUserAvatar);
const mockedUpdateUserComplianceRead = vi.mocked(users.updateUserComplianceRead);
const mockedUpdateUserEmail = vi.mocked(users.updateUserEmail);
const mockedUpdateUserName = vi.mocked(users.updateUserName);
const mockedUpdateUserOnboardingCompletedTasks = vi.mocked(users.updateUserOnboardingCompletedTasks);
const mockedUpdateUserPassword = vi.mocked(users.updateUserPassword);
const mockedUpdateUserViewPreferences = vi.mocked(users.updateUserViewPreferences);
const session = { user: { id: "user-1", name: "User", email: "user@example.test", groups: [] }, expires: "2099-01-01T00:00:00.000Z" };

const defaultPreferences = {
  countryCode: "",
  language: "en" as const,
  dateFormat: "dd/MM/yyyy" as const,
  timeFormat: "HH:mm" as const,
  windUnit: "bft" as const,
  waterHeightUnit: "m" as const,
  temperatureUnit: "°C" as const,
  coordinateFormat: "decimal" as const,
  distanceDisplayUnit: "off" as const,
  defaultBoatId: "",
  defaultCrewMemberIds: [],
  theme: "light" as const,
  isNavSlim: false,
  showCourseConversionTable: true,
  showAvatarOnPrint: true,
};

function appUser(overrides = {}) {
  return { id: "user-1", name: "User", email: "user@example.test", emailVerified: true, hasUploadedAvatar: false, groups: [], onboardingCompletedTasks: [], hasReadCompliance: false, ...defaultPreferences, ...overrides };
}

describe("profile endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires authentication for profile updates", async () => {
    mockedAuth.mockResolvedValueOnce(null);

    const response = await PATCH(new Request("https://ultilog.test/api/profile", {
      method: "PATCH",
      body: JSON.stringify({ action: "name" }),
    }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns the signed-in user profile", async () => {
    mockedAuth.mockResolvedValueOnce(session);
    mockedFindUserById.mockResolvedValueOnce(appUser({ avatar: "https://www.gravatar.com/avatar/hash?s=256&d=mp", onboardingCompletedTasks: ["create_first_boat"], theme: "dark", isNavSlim: true, hasReadCompliance: true }));

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ id: "user-1", name: "User", email: "user@example.test", emailVerified: true, avatar: "https://www.gravatar.com/avatar/hash?s=256&d=mp", hasUploadedAvatar: false, groups: [], onboardingCompletedTasks: ["create_first_boat"], preferences: { ...defaultPreferences, theme: "dark", isNavSlim: true }, theme: "dark", isNavSlim: true, hasReadCompliance: true });
    expect(mockedFindUserById).toHaveBeenCalledWith("user-1");
  });

  it("removes the signed-in user's uploaded avatar", async () => {
    mockedAuth.mockResolvedValueOnce(session);
    mockedRemoveUserAvatar.mockResolvedValueOnce("https://www.gravatar.com/avatar/hash?s=256&d=mp");

    const response = await PATCH(new Request("https://ultilog.test/api/profile", {
      method: "PATCH",
      body: JSON.stringify({ action: "avatar-remove" }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ avatar: "https://www.gravatar.com/avatar/hash?s=256&d=mp", hasUploadedAvatar: false });
    expect(mockedRemoveUserAvatar).toHaveBeenCalledWith("user-1");
  });

  it("updates the signed-in user's name", async () => {
    mockedAuth.mockResolvedValueOnce(session);
    mockedUpdateUserName.mockResolvedValueOnce(appUser({ name: "Updated User" }));

    const response = await PATCH(new Request("https://ultilog.test/api/profile", {
      method: "PATCH",
      body: JSON.stringify({ action: "name", name: "Updated User", currentPassword: "password123" }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ name: "Updated User" });
    expect(mockedUpdateUserName).toHaveBeenCalledWith("user-1", { name: "Updated User", currentPassword: "password123" });
  });

  it("updates the signed-in user's email", async () => {
    mockedAuth.mockResolvedValueOnce(session);
    mockedUpdateUserEmail.mockResolvedValueOnce(appUser({ email: "updated@example.test", emailVerified: false }));

    const response = await PATCH(new Request("https://ultilog.test/api/profile", {
      method: "PATCH",
      body: JSON.stringify({ action: "email", email: "updated@example.test", currentPassword: "password123" }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ email: "updated@example.test", emailVerified: false });
    expect(mockedUpdateUserEmail).toHaveBeenCalledWith("user-1", { email: "updated@example.test", currentPassword: "password123" });
  });

  it("updates the signed-in user's password", async () => {
    mockedAuth.mockResolvedValueOnce(session);
    mockedUpdateUserPassword.mockResolvedValueOnce();

    const response = await PATCH(new Request("https://ultilog.test/api/profile", {
      method: "PATCH",
      body: JSON.stringify({ action: "password", currentPassword: "password123", newPassword: "newpassword123" }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mockedUpdateUserPassword).toHaveBeenCalledWith("user-1", { currentPassword: "password123", newPassword: "newpassword123" });
  });

  it("updates manual onboarding completion", async () => {
    mockedAuth.mockResolvedValueOnce(session);
    mockedUpdateUserOnboardingCompletedTasks.mockResolvedValueOnce(appUser({ onboardingCompletedTasks: ["create_first_boat", "create_first_logsheet"] }));

    const response = await PATCH(new Request("https://ultilog.test/api/profile", {
      method: "PATCH",
      body: JSON.stringify({ action: "onboarding", onboardingCompletedTasks: ["create_first_boat", "create_first_logsheet", "unknown_task"] }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ onboardingCompletedTasks: ["create_first_boat", "create_first_logsheet"] });
    expect(mockedUpdateUserOnboardingCompletedTasks).toHaveBeenCalledWith("user-1", ["create_first_boat", "create_first_logsheet", "unknown_task"]);
  });

  it("updates profile view preferences", async () => {
    mockedAuth.mockResolvedValueOnce(session);
    mockedUpdateUserViewPreferences.mockResolvedValueOnce(appUser({ theme: "dark", isNavSlim: true, hasReadCompliance: true, countryCode: "US", language: "de", windUnit: "kn", waterHeightUnit: "ft", temperatureUnit: "f", coordinateFormat: "dms", distanceDisplayUnit: "mi", defaultBoatId: "boat-1", defaultCrewMemberIds: ["crew-1"], showCourseConversionTable: false, showAvatarOnPrint: false }));

    const response = await PATCH(new Request("https://ultilog.test/api/profile", {
      method: "PATCH",
      body: JSON.stringify({ action: "preferences", preferences: { countryCode: "US", language: "de", dateFormat: "dd/MM/yyyy", timeFormat: "HH:mm", windUnit: "kn", waterHeightUnit: "ft", temperatureUnit: "f", coordinateFormat: "dms", distanceDisplayUnit: "mi", defaultBoatId: "boat-1", defaultCrewMemberIds: ["crew-1"], theme: "dark", isNavSlim: true, showCourseConversionTable: false, showAvatarOnPrint: false } }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ preferences: { countryCode: "US", language: "de", dateFormat: "dd/MM/yyyy", timeFormat: "HH:mm", windUnit: "kn", waterHeightUnit: "ft", temperatureUnit: "f", coordinateFormat: "dms", distanceDisplayUnit: "mi", defaultBoatId: "boat-1", defaultCrewMemberIds: ["crew-1"], theme: "dark", isNavSlim: true, showCourseConversionTable: false, showAvatarOnPrint: false }, theme: "dark", isNavSlim: true });
    expect(mockedUpdateUserViewPreferences).toHaveBeenCalledWith("user-1", { countryCode: "US", language: "de", dateFormat: "dd/MM/yyyy", timeFormat: "HH:mm", windUnit: "kn", waterHeightUnit: "ft", temperatureUnit: "f", coordinateFormat: "dms", distanceDisplayUnit: "mi", defaultBoatId: "boat-1", defaultCrewMemberIds: ["crew-1"], theme: "dark", isNavSlim: true, showCourseConversionTable: false, showAvatarOnPrint: false });
  });

  it("marks compliance information as read", async () => {
    mockedAuth.mockResolvedValueOnce(session);
    mockedUpdateUserComplianceRead.mockResolvedValueOnce(appUser({ hasReadCompliance: true }));

    const response = await PATCH(new Request("https://ultilog.test/api/profile", {
      method: "PATCH",
      body: JSON.stringify({ action: "compliance-read" }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ hasReadCompliance: true });
    expect(mockedUpdateUserComplianceRead).toHaveBeenCalledWith("user-1");
  });

  it("deletes the signed-in user's account", async () => {
    mockedAuth.mockResolvedValueOnce(session);
    mockedDeleteUserAccount.mockResolvedValueOnce();

    const response = await DELETE(new Request("https://ultilog.test/api/profile", {
      method: "DELETE",
      body: JSON.stringify({ currentPassword: "password123" }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mockedDeleteUserAccount).toHaveBeenCalledWith("user-1", { currentPassword: "password123" });
  });
});

import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

vi.mock("../../../auth", () => ({
  auth: vi.fn(),
}));

vi.mock("../../../app/lib/users", () => ({
  deleteUserAccountAsAdmin: vi.fn(),
  listKnownGroups: vi.fn(),
  listUsersForAdmin: vi.fn(),
  updateUserGroups: vi.fn(),
  userHasGroup: vi.fn(),
}));

const { auth } = await import("../../../auth");
const users = await import("../../../app/lib/users");
const { DELETE, GET, PATCH } = await import("../../../app/api/admin/users/route");

const mockedAuth = auth as unknown as Mock;
const mockedDeleteUserAccountAsAdmin = vi.mocked(users.deleteUserAccountAsAdmin);
const mockedListKnownGroups = vi.mocked(users.listKnownGroups);
const mockedListUsersForAdmin = vi.mocked(users.listUsersForAdmin);
const mockedUpdateUserGroups = vi.mocked(users.updateUserGroups);
const mockedUserHasGroup = vi.mocked(users.userHasGroup);

const adminSession = { user: { id: "admin-user", name: "Admin", email: "admin@example.test", groups: ["admin"] }, expires: "2099-01-01T00:00:00.000Z" };

describe("admin users endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns unauthorized when no user is signed in", async () => {
    mockedAuth.mockResolvedValueOnce(null);

    const response = await GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(mockedUserHasGroup).not.toHaveBeenCalled();
  });

  it("returns forbidden when the current user lacks the persisted admin group", async () => {
    mockedAuth.mockResolvedValueOnce(adminSession);
    mockedUserHasGroup.mockResolvedValueOnce(false);

    const response = await GET();

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Forbidden" });
    expect(mockedUserHasGroup).toHaveBeenCalledWith("admin-user", "admin");
  });

  it("lists users and known groups for admins", async () => {
    const listedUsers = [{ id: "demo", name: "Demo", email: "demo@ultilog.local", groups: ["demo"] }];
    mockedAuth.mockResolvedValueOnce(adminSession);
    mockedUserHasGroup.mockResolvedValueOnce(true);
    mockedListUsersForAdmin.mockResolvedValueOnce(listedUsers);
    mockedListKnownGroups.mockResolvedValueOnce(["admin", "demo"]);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ users: listedUsers, groups: ["admin", "demo"] });
  });


  it("prevents admins from removing their own admin group", async () => {
    mockedAuth.mockResolvedValueOnce(adminSession);
    mockedUserHasGroup.mockResolvedValueOnce(true);

    const response = await PATCH(new Request("https://ultilog.test/api/admin/users", {
      method: "PATCH",
      body: JSON.stringify({ userId: "admin-user", groups: ["demo"] }),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "You cannot remove the admin group from your own account." });
    expect(mockedUpdateUserGroups).not.toHaveBeenCalled();
  });

  it("updates groups for admins", async () => {
    const updatedUser = { id: "demo", name: "Demo", email: "demo@ultilog.local", groups: ["demo", "reviewer"] };
    mockedAuth.mockResolvedValueOnce(adminSession);
    mockedUserHasGroup.mockResolvedValueOnce(true);
    mockedUpdateUserGroups.mockResolvedValueOnce(updatedUser);
    mockedListKnownGroups.mockResolvedValueOnce(["admin", "demo", "reviewer"]);

    const response = await PATCH(new Request("https://ultilog.test/api/admin/users", {
      method: "PATCH",
      body: JSON.stringify({ userId: "demo", groups: ["demo", "reviewer"] }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ user: updatedUser, groups: ["admin", "demo", "reviewer"] });
    expect(mockedUpdateUserGroups).toHaveBeenCalledWith("demo", ["demo", "reviewer"]);
  });

  it("prevents admins from deleting their own account from the admin page", async () => {
    mockedAuth.mockResolvedValueOnce(adminSession);
    mockedUserHasGroup.mockResolvedValueOnce(true);

    const response = await DELETE(new Request("https://ultilog.test/api/admin/users", {
      method: "DELETE",
      body: JSON.stringify({ userId: "admin-user", confirmationName: "Admin" }),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "You cannot delete your own account from the admin page." });
    expect(mockedDeleteUserAccountAsAdmin).not.toHaveBeenCalled();
  });

  it("deletes users for admins when the username confirmation is provided", async () => {
    mockedAuth.mockResolvedValueOnce(adminSession);
    mockedUserHasGroup.mockResolvedValueOnce(true);
    mockedDeleteUserAccountAsAdmin.mockResolvedValueOnce();

    const response = await DELETE(new Request("https://ultilog.test/api/admin/users", {
      method: "DELETE",
      body: JSON.stringify({ userId: "demo", confirmationName: "Demo" }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mockedDeleteUserAccountAsAdmin).toHaveBeenCalledWith("demo", "Demo");
  });

});

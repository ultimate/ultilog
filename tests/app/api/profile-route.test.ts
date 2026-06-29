import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

vi.mock("../../../auth", () => ({
  auth: vi.fn(),
}));

vi.mock("../../../app/lib/users", () => ({
  deleteUserAccount: vi.fn(),
  updateUserEmail: vi.fn(),
  updateUserName: vi.fn(),
  updateUserPassword: vi.fn(),
}));

const { auth } = await import("../../../auth");
const users = await import("../../../app/lib/users");
const { DELETE, PATCH } = await import("../../../app/api/profile/route");

const mockedAuth = auth as unknown as Mock;
const mockedDeleteUserAccount = vi.mocked(users.deleteUserAccount);
const mockedUpdateUserEmail = vi.mocked(users.updateUserEmail);
const mockedUpdateUserName = vi.mocked(users.updateUserName);
const mockedUpdateUserPassword = vi.mocked(users.updateUserPassword);
const session = { user: { id: "user-1", name: "User", email: "user@example.test", groups: [] }, expires: "2099-01-01T00:00:00.000Z" };

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

  it("updates the signed-in user's name", async () => {
    mockedAuth.mockResolvedValueOnce(session);
    mockedUpdateUserName.mockResolvedValueOnce({ id: "user-1", name: "Updated User", email: "user@example.test", groups: [] });

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
    mockedUpdateUserEmail.mockResolvedValueOnce({ id: "user-1", name: "User", email: "updated@example.test", groups: [] });

    const response = await PATCH(new Request("https://ultilog.test/api/profile", {
      method: "PATCH",
      body: JSON.stringify({ action: "email", email: "updated@example.test", currentPassword: "password123" }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ email: "updated@example.test" });
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

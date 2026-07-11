import { describe, expect, it, vi } from "vitest";

vi.mock("../../../app/lib/users", () => ({
  requestPasswordReset: vi.fn(),
  resetPasswordWithToken: vi.fn(),
}));

const { requestPasswordReset, resetPasswordWithToken } = await import("../../../app/lib/users");
const requestRoute = await import("../../../app/api/password-reset/request/route");
const confirmRoute = await import("../../../app/api/password-reset/confirm/route");

const mockedRequestPasswordReset = vi.mocked(requestPasswordReset);
const mockedResetPasswordWithToken = vi.mocked(resetPasswordWithToken);

describe("password reset request endpoint", () => {
  it("always returns a generic success message", async () => {
    mockedRequestPasswordReset.mockResolvedValueOnce();

    const response = await requestRoute.POST(new Request("https://ultilog.test/api/password-reset/request", {
      method: "POST",
      body: JSON.stringify({ email: "sailor@example.test" }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ message: "If an account exists for that email, a password reset link has been sent." });
    expect(mockedRequestPasswordReset).toHaveBeenCalledWith("sailor@example.test");
  });

  it("does not leak backend errors", async () => {
    mockedRequestPasswordReset.mockRejectedValueOnce(new Error("smtp unavailable"));

    const response = await requestRoute.POST(new Request("https://ultilog.test/api/password-reset/request", {
      method: "POST",
      body: JSON.stringify({ email: "missing@example.test" }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ message: "If an account exists for that email, a password reset link has been sent." });
  });
});

describe("password reset confirm endpoint", () => {
  it("updates the password with a valid token", async () => {
    mockedResetPasswordWithToken.mockResolvedValueOnce();

    const response = await confirmRoute.POST(new Request("https://ultilog.test/api/password-reset/confirm", {
      method: "POST",
      body: JSON.stringify({ token: "raw-token", password: "new-password" }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ message: "Password updated." });
    expect(mockedResetPasswordWithToken).toHaveBeenCalledWith("raw-token", "new-password");
  });

  it("returns reset validation errors", async () => {
    mockedResetPasswordWithToken.mockRejectedValueOnce(new Error("This password reset link has expired."));

    const response = await confirmRoute.POST(new Request("https://ultilog.test/api/password-reset/confirm", {
      method: "POST",
      body: JSON.stringify({ token: "expired", password: "new-password" }),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "This password reset link has expired." });
  });
});

import { describe, expect, it, vi } from "vitest";

vi.mock("../../../app/lib/users", () => ({
  requestEmailVerification: vi.fn(),
  verifyEmailWithToken: vi.fn(),
}));

const { requestEmailVerification, verifyEmailWithToken } = await import("../../../app/lib/users");
const requestRoute = await import("../../../app/api/email-verification/request/route");
const confirmRoute = await import("../../../app/api/email-verification/confirm/route");

const mockedRequestEmailVerification = vi.mocked(requestEmailVerification);
const mockedVerifyEmailWithToken = vi.mocked(verifyEmailWithToken);

describe("email verification request endpoint", () => {
  it("requests another verification email with a generic response", async () => {
    const response = await requestRoute.POST(new Request("https://ultilog.test/api/email-verification/request", {
      method: "POST",
      body: JSON.stringify({ email: "sailor@example.test" }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ message: "If the email is registered and still unverified, a new verification link has been sent." });
    expect(mockedRequestEmailVerification).toHaveBeenCalledWith("sailor@example.test");
  });
});

describe("email verification confirm endpoint", () => {
  it("verifies an email token", async () => {
    const response = await confirmRoute.POST(new Request("https://ultilog.test/api/email-verification/confirm", {
      method: "POST",
      body: JSON.stringify({ token: "raw-token" }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ message: "Email verified." });
    expect(mockedVerifyEmailWithToken).toHaveBeenCalledWith("raw-token");
  });
});

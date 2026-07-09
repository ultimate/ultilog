import { describe, expect, it, vi } from "vitest";

vi.mock("../../../app/lib/users", () => ({
  registerUser: vi.fn(),
}));

const { registerUser } = await import("../../../app/lib/users");
const { POST } = await import("../../../app/api/register/route");

const mockedRegisterUser = vi.mocked(registerUser);

describe("register endpoint", () => {
  it("creates a user and returns 201", async () => {
    const user = { id: "new-user", name: "New User", email: "new@example.test", groups: [], onboardingCompletedTasks: [], countryCode: "", language: "en" as const, windUnit: "bft" as const, waterHeightUnit: "m" as const, temperatureUnit: "°C" as const, coordinateFormat: "decimal" as const, distanceDisplayUnit: "off" as const, defaultBoatId: "", defaultCrewMemberIds: [], showCourseConversionTable: true, theme: "light" as const, isNavSlim: false, hasReadCompliance: false };
    mockedRegisterUser.mockResolvedValueOnce(user);

    const response = await POST(new Request("https://ultilog.test/api/register", {
      method: "POST",
      body: JSON.stringify({ name: "New User", email: "new@example.test", password: "password123" }),
    }));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual(user);
    expect(mockedRegisterUser).toHaveBeenCalledWith({ name: "New User", email: "new@example.test", password: "password123" });
  });

  it("returns validation errors from registration", async () => {
    mockedRegisterUser.mockRejectedValueOnce(new Error("An account with this email already exists."));

    const response = await POST(new Request("https://ultilog.test/api/register", {
      method: "POST",
      body: JSON.stringify({ email: "new@example.test" }),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "An account with this email already exists." });
    expect(mockedRegisterUser).toHaveBeenCalledWith({ name: "", email: "new@example.test", password: "" });
  });
});

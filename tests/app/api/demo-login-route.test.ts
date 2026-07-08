import { describe, expect, it, vi } from "vitest";

vi.mock("../../../app/lib/users", () => ({
  validateDemoUser: vi.fn(),
}));

const { validateDemoUser } = await import("../../../app/lib/users");
const { POST } = await import("../../../app/api/demo-login/route");
const { config: proxyConfig } = await import("../../../proxy");

const mockedValidateDemoUser = vi.mocked(validateDemoUser);

describe("demo login endpoint", () => {
  it("returns ok when the seeded demo user is available", async () => {
    mockedValidateDemoUser.mockResolvedValueOnce({ id: "legacy-user", name: "Local demo user", email: "demo@ultilog.local", groups: ["demo"], onboardingCompletedTasks: [], theme: "light", isNavSlim: false, hasReadCompliance: false });

    const response = await POST();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mockedValidateDemoUser).toHaveBeenCalledOnce();
  });

  it("returns not found when the demo user is unavailable", async () => {
    mockedValidateDemoUser.mockResolvedValueOnce(null);

    const response = await POST();

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Demo user is not available." });
  });

  it("excludes demo-login requests from the auth proxy matcher", () => {
    expect(proxyConfig.matcher.join(" ")).toContain("api/demo-login");
  });
});

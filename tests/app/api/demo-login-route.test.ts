import { describe, expect, it, vi } from "vitest";

vi.mock("../../../app/lib/demo/demo-sandboxes", () => ({
  createDemoSandbox: vi.fn(),
  DemoCapacityError: class DemoCapacityError extends Error {},
}));

vi.mock("../../../app/lib/security/rate-limiter", async () => {
  const actual = await vi.importActual<typeof import("../../../app/lib/security/rate-limiter")>("../../../app/lib/security/rate-limiter");
  return { ...actual, enforceRateLimits: vi.fn().mockResolvedValue(undefined) };
});

const { createDemoSandbox } = await import("../../../app/lib/demo/demo-sandboxes");
const { POST } = await import("../../../app/api/demo-login/route");
const { config: proxyConfig } = await import("../../../proxy");

const mockedCreateDemoSandbox = vi.mocked(createDemoSandbox);

describe("demo login endpoint", () => {
  it("creates a sandbox and returns its one-time login token", async () => {
    mockedCreateDemoSandbox.mockResolvedValueOnce({ token: "one-time-token", expiresAt: "2026-07-29T00:00:00.000Z" });

    const response = await POST(new Request("https://example.test/api/demo-login", { method: "POST", headers: { "x-real-ip": "192.0.2.1", "x-device-id": "browser-installation-1", "user-agent": "shared-browser-agent" } }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ token: "one-time-token", expiresAt: "2026-07-29T00:00:00.000Z" });
    expect(mockedCreateDemoSandbox).toHaveBeenCalledWith({
      ipHash: "37fcff24bf62035b2b08020afc08b4fecd4fcffce57ab23518e3561ff0fe76b9",
      deviceHash: "161f4c9ac1065025f821e5afb190ef86b11abf8ed6e8d96951dbc5fd6b857b94",
    });
  });

  it("returns service unavailable when sandbox creation fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockedCreateDemoSandbox.mockRejectedValueOnce(new Error("database unavailable"));

    const response = await POST();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "Demo is temporarily unavailable." });
    consoleError.mockRestore();
  });

  it("excludes demo-login requests from the auth proxy matcher", () => {
    expect(proxyConfig.matcher.join(" ")).toContain("api/demo-login");
  });
});

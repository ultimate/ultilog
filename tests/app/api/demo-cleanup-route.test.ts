import { describe, expect, it, vi } from "vitest";

vi.mock("../../../app/lib/demo/demo-sandboxes", () => ({ cleanupExpiredDemoSandboxes: vi.fn() }));

const { cleanupExpiredDemoSandboxes } = await import("../../../app/lib/demo/demo-sandboxes");
const { GET, POST } = await import("../../../app/api/demo-cleanup/route");
const { config: proxyConfig } = await import("../../../proxy");
const mockedCleanup = vi.mocked(cleanupExpiredDemoSandboxes);

describe("demo cleanup endpoint", () => {
  it("requires cleanup configuration", async () => {
    delete process.env.CRON_SECRET;
    delete process.env.DEMO_CLEANUP_SECRET;
    const response = await GET(new Request("https://ultilog.test/api/demo-cleanup"));
    expect(response.status).toBe(503);
  });

  it("rejects an invalid bearer token", async () => {
    process.env.DEMO_CLEANUP_SECRET = "cleanup-secret";
    const response = await POST(new Request("https://ultilog.test/api/demo-cleanup", { method: "POST", headers: { authorization: "Bearer wrong" } }));
    expect(response.status).toBe(401);
    expect(mockedCleanup).not.toHaveBeenCalled();
    delete process.env.DEMO_CLEANUP_SECRET;
  });

  it("runs cleanup for an authorized scheduler", async () => {
    process.env.CRON_SECRET = "cron-secret";
    mockedCleanup.mockResolvedValueOnce({ sandboxesDeleted: 4, loginTokensDeleted: 7 });
    const response = await GET(new Request("https://ultilog.test/api/demo-cleanup", { headers: { authorization: "Bearer cron-secret" } }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ sandboxesDeleted: 4, loginTokensDeleted: 7 });
    delete process.env.CRON_SECRET;
  });

  it("is reachable without an interactive user session", () => {
    expect(proxyConfig.matcher.join(" ")).toContain("api/demo-cleanup");
  });
});

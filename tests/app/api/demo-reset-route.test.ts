import { describe, expect, it, vi, type Mock } from "vitest";

vi.mock("../../../auth", () => ({ auth: vi.fn() }));
vi.mock("../../../app/lib/demo/demo-sandboxes", () => ({ resetDemoSandbox: vi.fn() }));

const { auth } = await import("../../../auth");
const { resetDemoSandbox } = await import("../../../app/lib/demo/demo-sandboxes");
const { POST } = await import("../../../app/api/demo-reset/route");

const mockedAuth = auth as unknown as Mock;
const mockedResetDemoSandbox = vi.mocked(resetDemoSandbox);
const logbook = { boats: [], crewMembers: [], sheets: [] };

describe("demo reset endpoint", () => {
  it("requires authentication", async () => {
    mockedAuth.mockResolvedValueOnce(null);
    const response = await POST();
    expect(response.status).toBe(401);
    expect(mockedResetDemoSandbox).not.toHaveBeenCalled();
  });

  it("resets only the signed-in sandbox", async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: "demo-one" }, expires: "2099-01-01" });
    mockedResetDemoSandbox.mockResolvedValueOnce(logbook);
    const response = await POST();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ logbook });
    expect(mockedResetDemoSandbox).toHaveBeenCalledWith("demo-one");
  });

  it("rejects regular and expired accounts", async () => {
    mockedAuth.mockResolvedValueOnce({ user: { id: "regular-user" }, expires: "2099-01-01" });
    mockedResetDemoSandbox.mockResolvedValueOnce(null);
    const response = await POST();
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Only an active demo sandbox can be reset." });
  });

  it("returns a server error when replacement fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockedAuth.mockResolvedValueOnce({ user: { id: "demo-one" }, expires: "2099-01-01" });
    mockedResetDemoSandbox.mockRejectedValueOnce(new Error("write failed"));
    const response = await POST();
    expect(response.status).toBe(500);
    consoleError.mockRestore();
  });
});

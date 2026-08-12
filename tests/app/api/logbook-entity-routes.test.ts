import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

vi.mock("../../../auth", () => ({ auth: vi.fn() }));
vi.mock("../../../app/lib/logbook-store", () => ({
  upsertBoat: vi.fn(), deleteBoat: vi.fn(), upsertCrewMember: vi.fn(), deleteCrewMember: vi.fn(), upsertLogSheet: vi.fn(), deleteLogSheet: vi.fn(),
}));

const { auth } = await import("../../../auth");
const store = await import("../../../app/lib/logbook-store");
const boats = await import("../../../app/api/logbook/boats/route");
const boat = await import("../../../app/api/logbook/boats/[id]/route");
const { ENTITY_REQUEST_LIMITS } = await import("../../../app/lib/validation/request-limits");

const entity = { id: "boat-1", name: "Aurora", type: "Sail" as const, registration: "", flagState: "", homePort: "", owner: "", dimensions: "", logfactor: 1, yachtData: {}, deviationTable: [] };
const context = (id: string) => ({ params: Promise.resolve({ id }) });
const mockedAuth = auth as unknown as Mock;

describe("entity mutation routes", () => {
  beforeEach(() => { vi.clearAllMocks(); mockedAuth.mockResolvedValue({ user: { id: "owner-1" }, expires: "2099-01-01" }); });

  it("requires authentication", async () => {
    mockedAuth.mockResolvedValueOnce(null);
    const response = await boats.POST(new Request("https://example.test/api/logbook/boats", { method: "POST", body: JSON.stringify(entity) }));
    expect(response.status).toBe(401);
    expect(store.upsertBoat).not.toHaveBeenCalled();
  });

  it("creates and returns only the owner-scoped entity", async () => {
    vi.mocked(store.upsertBoat).mockResolvedValueOnce(entity);
    const response = await boats.POST(new Request("https://example.test/api/logbook/boats", { method: "POST", body: JSON.stringify(entity) }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(entity);
    expect(store.upsertBoat).toHaveBeenCalledWith(entity, "owner-1");
  });

  it("rejects a body id that differs from the route id", async () => {
    const response = await boat.PUT(new Request("https://example.test/api/logbook/boats/other", { method: "PUT", body: JSON.stringify(entity) }), context("other"));
    expect(response.status).toBe(400);
    expect(store.upsertBoat).not.toHaveBeenCalled();
  });

  it("rejects an oversized declared boat body before reading it", async () => {
    const request = new Request("https://example.test/api/logbook/boats", { method: "POST", headers: { "content-length": String(ENTITY_REQUEST_LIMITS.boat + 1) }, body: JSON.stringify(entity) });
    const readSpy = vi.spyOn(request, "text");
    const response = await boats.POST(request);
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({ code: "request_too_large" });
    expect(readSpy).not.toHaveBeenCalled();
    expect(store.upsertBoat).not.toHaveBeenCalled();
  });

  it("accepts a declared boat body exactly at its endpoint limit", async () => {
    vi.mocked(store.upsertBoat).mockResolvedValueOnce(entity);
    const response = await boats.POST(new Request("https://example.test/api/logbook/boats", { method: "POST", headers: { "content-length": String(ENTITY_REQUEST_LIMITS.boat) }, body: JSON.stringify(entity) }));
    expect(response.status).toBe(200);
  });

  it("returns not found for cross-owner ids and preserves policy conflicts", async () => {
    vi.mocked(store.deleteBoat).mockResolvedValueOnce(undefined);
    expect((await boat.DELETE(new Request("https://example.test"), context("foreign"))).status).toBe(404);
    vi.mocked(store.deleteBoat).mockRejectedValueOnce(Object.assign(new Error("referenced"), { code: "referenced_boat_deleted" }));
    const response = await boat.DELETE(new Request("https://example.test"), context("boat-1"));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: "referenced_boat_deleted" });
  });
});

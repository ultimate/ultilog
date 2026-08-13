import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

vi.mock("../../../auth", () => ({ auth: vi.fn() }));
vi.mock("../../../app/lib/logbook-store", () => ({
  createStoredImage: vi.fn(), readStoredImage: vi.fn(), deleteStoredImage: vi.fn(),
}));

const { auth } = await import("../../../auth");
const store = await import("../../../app/lib/logbook-store");
const collection = await import("../../../app/api/images/route");
const item = await import("../../../app/api/images/[id]/route");
const context = (id: string) => ({ params: Promise.resolve({ id }) });
const image = { data: "iVBORw0KGgo=", mimeType: "image/png", width: 2, height: 3 };

describe("stored image routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (auth as unknown as Mock).mockResolvedValue({ user: { id: "owner-1" } });
  });

  it("uploads bytes once and returns the generated stable id", async () => {
    vi.mocked(store.createStoredImage).mockImplementationOnce(async (id, value) => ({ id, ...value }));
    const response = await collection.POST(new Request("https://example.test/api/images", { method: "POST", body: JSON.stringify(image) }));
    const stored = await response.json();

    expect(response.status).toBe(201);
    expect(stored).toEqual({ id: expect.any(String), ...image });
    expect(store.createStoredImage).toHaveBeenCalledWith(stored.id, image, "owner-1");
  });

  it("does not disclose foreign image existence and reports referenced deletion", async () => {
    vi.mocked(store.readStoredImage).mockResolvedValueOnce(undefined);
    vi.mocked(store.deleteStoredImage).mockResolvedValueOnce(false);
    expect((await item.GET(new Request("https://example.test"), context("foreign"))).status).toBe(404);
    expect((await item.DELETE(new Request("https://example.test", { method: "DELETE" }), context("foreign"))).status).toBe(404);

    vi.mocked(store.deleteStoredImage).mockRejectedValueOnce(Object.assign(new Error("referenced"), { code: "referenced_image" }));
    const referenced = await item.DELETE(new Request("https://example.test", { method: "DELETE" }), context("attached"));
    expect(referenced.status).toBe(409);
    await expect(referenced.json()).resolves.toEqual({ error: "Stored image is still referenced.", code: "referenced_image" });
  });
});

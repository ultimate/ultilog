import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

vi.mock("../../../auth", () => ({ auth: vi.fn() }));
vi.mock("../../../app/lib/logbook-store", () => ({ copySharedLogSheet: vi.fn() }));

const { auth } = await import("../../../auth");
const store = await import("../../../app/lib/logbook-store");
const { POST } = await import("../../../app/api/shared/logbooks/[ownerId]/[sheetId]/copy/route");
const mockedAuth = auth as unknown as Mock;
const mockedCopy = vi.mocked(store.copySharedLogSheet);
const context = { params: Promise.resolve({ ownerId: "source-owner", sheetId: "source-sheet" }) };

function request(body: unknown, origin = "https://ultilog.test") {
  return new Request("https://ultilog.test/api/shared/logbooks/source-owner/source-sheet/copy", {
    method: "POST", headers: { "content-type": "application/json", origin }, body: JSON.stringify(body),
  });
}

describe("shared logbook copy endpoint", () => {
  beforeEach(() => { vi.clearAllMocks(); process.env.NEXTAUTH_URL = "https://ultilog.test"; });

  it("requires authentication", async () => {
    mockedAuth.mockResolvedValueOnce(null);
    expect((await POST(request({ destinationBoatId: "boat" }), context)).status).toBe(401);
    expect(mockedCopy).not.toHaveBeenCalled();
  });

  it("applies focused mutation origin protection", async () => {
    const response = await POST(request({ destinationBoatId: "boat" }, "https://evil.test"), context);
    expect(response.status).toBe(403);
    expect(mockedAuth).not.toHaveBeenCalled();
  });

  it("accepts only destination-specific options and returns the created id", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "recipient" } });
    mockedCopy.mockResolvedValueOnce({ id: "new-sheet" } as never);
    const response = await POST(request({ destinationBoatId: "boat", includeCrew: true, includePicture: true }), context);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ id: "new-sheet" });
    expect(mockedCopy).toHaveBeenCalledWith("source-owner", "source-sheet", { destinationBoatId: "boat", includeCrew: true, includePicture: true }, "recipient");

    const rejected = await POST(request({ destinationBoatId: "boat", lines: [] }), context);
    expect(rejected.status).toBe(400);
  });
});

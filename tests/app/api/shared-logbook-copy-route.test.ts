import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

vi.mock("../../../auth", () => ({ auth: vi.fn() }));
vi.mock("../../../app/lib/logbook-store", () => ({ copySharedLogSheet: vi.fn(), previewSharedLogSheetCopies: vi.fn() }));

const { auth } = await import("../../../auth");
const store = await import("../../../app/lib/logbook-store");
const { POST, GET } = await import("../../../app/api/shared/logbooks/[ownerId]/[sheetId]/copy/route");
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
  it("previews only authenticated copies without requiring a mutation Origin header", async () => {
    mockedAuth.mockResolvedValueOnce(null);
    expect((await GET(new Request("https://ultilog.test/copy"), context)).status).toBe(401);
    mockedAuth.mockResolvedValue({ user: { id: "recipient" } });
    vi.mocked(store.previewSharedLogSheetCopies).mockResolvedValueOnce({ copies: [] });
    const response = await GET(new Request("https://ultilog.test/copy", { headers: { cookie: "session=test" } }), context);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ copies: [] });
    expect(store.previewSharedLogSheetCopies).toHaveBeenCalledWith("source-owner", "source-sheet", "recipient");
  });

  it("validates explicit update targets and concurrency tokens", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "recipient" } });
    mockedCopy.mockResolvedValue({ id: "existing-copy" } as never);
    const options = { action: "update", targetCopyId: "existing-copy", expectedRevision: 3, expectedContentVersion: "a".repeat(64), destinationBoatId: "boat", includeCrew: false };
    expect((await POST(request(options), context)).status).toBe(200);
    expect(mockedCopy).toHaveBeenCalledWith("source-owner", "source-sheet", options, "recipient");
    for (const invalid of [{ ...options, expectedRevision: 0 }, { ...options, expectedContentVersion: undefined }, { ...options, targetCopyId: undefined }, { ...options, action: "create" }]) {
      expect((await POST(request(invalid), context)).status).toBe(400);
    }
  });

  it("returns source visibility and revision conflicts without mutating another copy", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "recipient" } });
    vi.mocked(store.previewSharedLogSheetCopies).mockRejectedValueOnce({ code: "shared_sections_not_visible" });
    expect((await GET(new Request("https://ultilog.test/copy"), context)).status).toBe(403);
    mockedCopy.mockRejectedValueOnce({ code: "revision_conflict" });
    expect((await POST(request({ destinationBoatId: "boat" }), context)).status).toBe(409);
  });

});

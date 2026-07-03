import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

vi.mock("../../../auth", () => ({
  auth: vi.fn(),
}));

vi.mock("../../../app/lib/logbook-store", () => ({
  readLogbook: vi.fn(),
  writeLogbook: vi.fn(),
}));

vi.mock("../../../app/lib/logbook-scanner/openai-provider", () => ({
  openAiScannerProvider: { extractLogbookDraft: vi.fn() },
}));

const { auth } = await import("../../../auth");
const store = await import("../../../app/lib/logbook-store");
const { openAiScannerProvider } = await import("../../../app/lib/logbook-scanner/openai-provider");
const { POST } = await import("../../../app/api/logbook/scanner/route");

const mockedAuth = auth as unknown as Mock;
const mockedReadLogbook = vi.mocked(store.readLogbook);
const mockedWriteLogbook = vi.mocked(store.writeLogbook);
const mockedScanner = vi.mocked(openAiScannerProvider.extractLogbookDraft);
const session = { user: { id: "user-1", name: "User", email: "user@example.test", groups: [] }, expires: "2099-01-01T00:00:00.000Z" };
const boat = { id: "boat-1", name: "Aurora", type: "Sail" as const, registration: "", flagState: "", homePort: "", owner: "", dimensions: "", yachtData: {}, deviationTable: [] };
const logbook = { boats: [boat], crewMembers: [], sheets: [] };

function scannerRequest(formData: FormData) {
  return new Request("https://ultilog.test/api/logbook/scanner", { method: "POST", body: formData });
}

function imageFile(name = "sheet.png", size = 1) {
  return new File([new Uint8Array(size)], name, { type: "image/png" });
}

describe("logbook scanner endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires authentication", async () => {
    mockedAuth.mockResolvedValueOnce(null);
    const formData = new FormData();

    const response = await POST(scannerRequest(formData));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(mockedReadLogbook).not.toHaveBeenCalled();
  });

  it("rejects boats outside the current user's logbook", async () => {
    mockedAuth.mockResolvedValueOnce(session);
    mockedReadLogbook.mockResolvedValueOnce(logbook);
    const formData = new FormData();
    formData.set("boatId", "missing-boat");
    formData.append("files", imageFile());

    const response = await POST(scannerRequest(formData));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Boat not found" });
    expect(mockedScanner).not.toHaveBeenCalled();
  });

  it("rejects non-image uploads", async () => {
    mockedAuth.mockResolvedValueOnce(session);
    mockedReadLogbook.mockResolvedValueOnce(logbook);
    const formData = new FormData();
    formData.set("boatId", "boat-1");
    formData.append("files", new File(["text"], "sheet.txt", { type: "text/plain" }));

    const response = await POST(scannerRequest(formData));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Only image files can be scanned" });
    expect(mockedScanner).not.toHaveBeenCalled();
  });

  it("adds a scanned sheet to the current user's logbook", async () => {
    mockedAuth.mockResolvedValueOnce(session);
    mockedReadLogbook.mockResolvedValueOnce(logbook);
    mockedScanner.mockResolvedValueOnce({
      draft: { title: "Scanned page", dateRange: "2026-07-03", route: { from: "A", to: "B", departed: "2026-07-03, 10:00", arrived: "2026-07-03, 12:00" }, lines: [] },
      warnings: ["Verify route."],
    });
    mockedWriteLogbook.mockImplementationOnce(async (updated) => updated);
    const formData = new FormData();
    formData.set("boatId", "boat-1");
    formData.append("files", imageFile());

    const response = await POST(scannerRequest(formData));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.sheetId).toEqual(expect.any(String));
    expect(mockedScanner).toHaveBeenCalledWith({ files: [{ name: "sheet.png", type: "image/png", buffer: expect.any(Buffer) }] });
    expect(mockedWriteLogbook).toHaveBeenCalledWith(expect.objectContaining({
      sheets: [expect.objectContaining({ id: body.sheetId, boatId: "boat-1", source: "scanner", title: "Scanned page" })],
    }), "user-1");
  });
});

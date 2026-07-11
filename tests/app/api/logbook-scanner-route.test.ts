import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

vi.mock("../../../auth", () => ({
  auth: vi.fn(),
}));

vi.mock("../../../app/lib/logbook-store", () => ({
  readLogbook: vi.fn(),
  writeLogbook: vi.fn(),
}));

vi.mock("../../../app/lib/logbook-scanner/openai-provider", () => ({
  openAiScannerProvider: { extractLogbookDraft: vi.fn(), isConfigured: vi.fn() },
}));

vi.mock("../../../app/lib/users", () => ({
  findUserById: vi.fn(),
}));

const { auth } = await import("../../../auth");
const store = await import("../../../app/lib/logbook-store");
const { openAiScannerProvider } = await import("../../../app/lib/logbook-scanner/openai-provider");
const { findUserById } = await import("../../../app/lib/users");
const { POST } = await import("../../../app/api/logbook/scanner/route");

const mockedAuth = auth as unknown as Mock;
const mockedReadLogbook = vi.mocked(store.readLogbook);
const mockedWriteLogbook = vi.mocked(store.writeLogbook);
const mockedScanner = vi.mocked(openAiScannerProvider.extractLogbookDraft);
const mockedScannerConfigured = vi.mocked(openAiScannerProvider.isConfigured);
const mockedFindUserById = vi.mocked(findUserById);
const session = { user: { id: "user-1", name: "User", email: "user@example.test", groups: [] }, expires: "2099-01-01T00:00:00.000Z" };
const boat = { id: "boat-1", name: "Aurora", type: "Sail" as const, registration: "", flagState: "", homePort: "", owner: "", dimensions: "", yachtData: {}, deviationTable: [] };
const logbook = { boats: [boat], crewMembers: [], sheets: [] };
const partialScannerResult = {
  draft: {
    title: "",
    dateRange: "2026-07-03",
    route: { from: "A", to: "", departed: "2026-07-03, 10:00", arrived: "" },
    lines: [{ time: "2026-07-03T10:30", latitude: "47° 30.000' N", remarks: "Smudged row" }],
  },
  warnings: ["Arrival port was unreadable.", "Verify line 1."],
};

function scannerRequest(formData: FormData) {
  return new Request("https://ultilog.test/api/logbook/scanner", { method: "POST", body: formData });
}

function imageFile(name = "sheet.png", size = 1) {
  return new File([new Uint8Array(size)], name, { type: "image/png" });
}

describe("logbook scanner endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedScannerConfigured.mockReturnValue(true);
    mockedFindUserById.mockResolvedValue({ ...session.user, countryCode: "", language: "en", windUnit: "bft", waterHeightUnit: "m", temperatureUnit: "°C", coordinateFormat: "decimal", distanceDisplayUnit: "off", defaultBoatId: "", defaultCrewMemberIds: [], theme: "light", isNavSlim: false, onboardingCompletedTasks: [], hasReadCompliance: false, showCourseConversionTable: true });
  });

  it("requires authentication", async () => {
    mockedAuth.mockResolvedValueOnce(null);
    const formData = new FormData();

    const response = await POST(scannerRequest(formData));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ code: "unauthenticated", error: "Sign in to scan logbook pages." });
    expect(mockedReadLogbook).not.toHaveBeenCalled();
  });

  it.each([
    { label: "missing boat selections", boatId: undefined, status: 400, body: { code: "missing_boat", error: "Choose a boat before scanning logbook pages." } },
    { label: "blank boat selections", boatId: "   ", status: 400, body: { code: "missing_boat", error: "Choose a boat before scanning logbook pages." } },
    { label: "boats outside the current user's logbook", boatId: "missing-boat", status: 404, body: { code: "invalid_boat", error: "The selected boat is not available in your logbook." } },
  ])("rejects $label", async ({ boatId, status, body }) => {
    mockedAuth.mockResolvedValueOnce(session);
    if (boatId?.trim()) mockedReadLogbook.mockResolvedValueOnce(logbook);
    const formData = new FormData();
    if (boatId !== undefined) formData.set("boatId", boatId);
    formData.append("files", imageFile());

    const response = await POST(scannerRequest(formData));

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual(body);
    if (!boatId?.trim()) expect(mockedReadLogbook).not.toHaveBeenCalled();
    expect(mockedScanner).not.toHaveBeenCalled();
  });

  it("rejects non-image uploads", async () => {
    mockedAuth.mockResolvedValueOnce(session);
    mockedReadLogbook.mockResolvedValueOnce(logbook);
    const formData = new FormData();
    formData.set("boatId", "boat-1");
    formData.append("files", new File(["text"], "sheet.txt", { type: "text/plain" }));

    const response = await POST(scannerRequest(formData));

    expect(response.status).toBe(415);
    await expect(response.json()).resolves.toEqual({ code: "unsupported_file_type", error: "Only image files can be scanned." });
    expect(mockedScanner).not.toHaveBeenCalled();
  });


  it("rejects oversized uploads", async () => {
    mockedAuth.mockResolvedValueOnce(session);
    mockedReadLogbook.mockResolvedValueOnce(logbook);
    const formData = new FormData();
    formData.set("boatId", "boat-1");
    formData.append("files", imageFile("sheet.png", 10 * 1024 * 1024 + 1));

    const response = await POST(scannerRequest(formData));

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({ code: "file_too_large", error: "Each image must be 10 MB or smaller." });
    expect(mockedScanner).not.toHaveBeenCalled();
  });

  it("rejects too many uploads", async () => {
    mockedAuth.mockResolvedValueOnce(session);
    mockedReadLogbook.mockResolvedValueOnce(logbook);
    const formData = new FormData();
    formData.set("boatId", "boat-1");
    Array.from({ length: 6 }, (_, index) => formData.append("files", imageFile(`sheet-${index}.png`)));

    const response = await POST(scannerRequest(formData));

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({ code: "too_many_files", error: "Upload at most 5 images at a time." });
    expect(mockedScanner).not.toHaveBeenCalled();
  });

  it("reports missing scanner provider configuration", async () => {
    mockedAuth.mockResolvedValueOnce(session);
    mockedReadLogbook.mockResolvedValueOnce(logbook);
    mockedScannerConfigured.mockReturnValueOnce(false);
    const formData = new FormData();
    formData.set("boatId", "boat-1");
    formData.append("files", imageFile());

    const response = await POST(scannerRequest(formData));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ code: "provider_configuration_missing", error: "Scanner provider is not configured. Set OPENAI_API_KEY before scanning logbook pages." });
    expect(mockedScanner).not.toHaveBeenCalled();
    expect(mockedWriteLogbook).not.toHaveBeenCalled();
  });

  it.each([
    {
      label: "invalid OpenAI API keys",
      error: { scannerProviderErrorCode: "authentication_failed" },
      status: 502,
      body: { code: "provider_authentication_failed", error: "Scanner provider authentication failed. Check the configured OpenAI API key." },
    },
    {
      label: "exhausted provider credits",
      error: { scannerProviderErrorCode: "quota_exceeded" },
      status: 402,
      body: { code: "provider_quota_exceeded", error: "Scanner provider quota or credits are exhausted. Check the OpenAI account billing and usage limits." },
    },
    {
      label: "OpenAI service outages",
      error: { scannerProviderErrorCode: "service_unavailable" },
      status: 503,
      body: { code: "provider_service_unavailable", error: "Scanner provider service is unavailable. Please try again later." },
    },
    {
      label: "unknown provider errors",
      error: new Error("offline"),
      status: 503,
      body: { code: "provider_unavailable", error: "Scanner provider is temporarily unavailable. Please try again later." },
    },
  ])("reports $label", async ({ error, status, body }) => {
    mockedAuth.mockResolvedValueOnce(session);
    mockedReadLogbook.mockResolvedValueOnce(logbook);
    mockedScanner.mockRejectedValueOnce(error);
    const formData = new FormData();
    formData.set("boatId", "boat-1");
    formData.append("files", imageFile());

    const response = await POST(scannerRequest(formData));

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual(body);
    expect(mockedWriteLogbook).not.toHaveBeenCalled();
  });

  it("rejects scans without readable logbook data", async () => {
    mockedAuth.mockResolvedValueOnce(session);
    mockedReadLogbook.mockResolvedValueOnce(logbook);
    mockedScanner.mockResolvedValueOnce({
      draft: { title: "", dateRange: "", route: { from: "", to: "", departed: "", arrived: "" }, lines: [] },
      warnings: ["No logbook rows were detected."],
    });
    const formData = new FormData();
    formData.set("boatId", "boat-1");
    formData.append("files", imageFile());

    const response = await POST(scannerRequest(formData));

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({ code: "no_readable_logbook_data", error: "No readable logbook data was found in the uploaded image(s). Try a clearer photo or enter the sheet manually." });
    expect(mockedWriteLogbook).not.toHaveBeenCalled();
  });

  it("creates a draft scanner sheet from partial scanner data without persisting raw image content", async () => {
    mockedAuth.mockResolvedValueOnce(session);
    mockedReadLogbook.mockResolvedValueOnce(logbook);
    mockedScanner.mockResolvedValueOnce(partialScannerResult);
    mockedWriteLogbook.mockImplementationOnce(async (updated) => updated);
    const formData = new FormData();
    formData.set("boatId", "boat-1");
    formData.append("files", imageFile("sheet.png", 4));

    const response = await POST(scannerRequest(formData));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.sheetId).toEqual(expect.any(String));
    expect(mockedScanner).toHaveBeenCalledWith({ files: [{ name: "sheet.png", type: "image/png", buffer: expect.any(Buffer) }] });
    expect(mockedWriteLogbook).toHaveBeenCalledWith(expect.objectContaining({
      sheets: [expect.objectContaining({
        id: body.sheetId,
        boatId: "boat-1",
        status: "Draft",
        source: "scanner",
        title: "Scanned log sheet",
        scannerWarnings: partialScannerResult.warnings,
        lines: [expect.objectContaining({ time: "2026-07-03T10:30", latitude: 47.5, remarks: "Smudged row" })],
      })],
    }), "user-1");

    const [[persistedLogbook]] = mockedWriteLogbook.mock.calls;
    expect(persistedLogbook.sheets[0].image).toBeUndefined();
    expect(JSON.stringify(persistedLogbook)).not.toContain("sheet.png");
    expect(JSON.stringify(persistedLogbook)).not.toContain("buffer");
  });

  it("defaults missing scanner units from user preferences", async () => {
    mockedAuth.mockResolvedValueOnce(session);
    mockedReadLogbook.mockResolvedValueOnce(logbook);
    mockedFindUserById.mockResolvedValueOnce({ ...session.user, countryCode: "", language: "en", windUnit: "kn", waterHeightUnit: "ft", temperatureUnit: "°F", coordinateFormat: "decimal", distanceDisplayUnit: "off", defaultBoatId: "", defaultCrewMemberIds: [], theme: "light", isNavSlim: false, onboardingCompletedTasks: [], hasReadCompliance: false, showCourseConversionTable: true });
    mockedScanner.mockResolvedValueOnce({
      draft: {
        title: "",
        dateRange: "2026-07-03",
        route: { from: "A", to: "B", departed: "2026-07-03, 10:00", arrived: "2026-07-03, 11:00" },
        lines: [{ time: "2026-07-03T10:30", windStrength: "12", windUnit: "", waves: "2", seaUnit: "", tide: "1", tideUnit: "", temperature: "70", temperatureUnit: "" }],
      },
      warnings: [],
    });
    mockedWriteLogbook.mockImplementationOnce(async (updated) => updated);
    const formData = new FormData();
    formData.set("boatId", "boat-1");
    formData.append("files", imageFile());

    const response = await POST(scannerRequest(formData));

    expect(response.status).toBe(200);
    const [[persistedLogbook]] = mockedWriteLogbook.mock.calls;
    expect(persistedLogbook.sheets[0].lines[0]).toEqual(expect.objectContaining({ windUnit: "kn", seaUnit: "ft", tideUnit: "ft", temperatureUnit: "°F" }));
  });

  it("preserves explicit scanner units instead of applying user preference defaults", async () => {
    mockedAuth.mockResolvedValueOnce(session);
    mockedReadLogbook.mockResolvedValueOnce(logbook);
    mockedFindUserById.mockResolvedValueOnce({ ...session.user, countryCode: "", language: "en", windUnit: "kn", waterHeightUnit: "ft", temperatureUnit: "°F", coordinateFormat: "decimal", distanceDisplayUnit: "off", defaultBoatId: "", defaultCrewMemberIds: [], theme: "light", isNavSlim: false, onboardingCompletedTasks: [], hasReadCompliance: false, showCourseConversionTable: true });
    mockedScanner.mockResolvedValueOnce({
      draft: {
        title: "",
        dateRange: "2026-07-03",
        route: { from: "A", to: "B", departed: "2026-07-03, 10:00", arrived: "2026-07-03, 11:00" },
        lines: [{ time: "2026-07-03T10:30", windStrength: "4", windUnit: "bft", waves: "0.5", seaUnit: "m", tide: "0.2", tideUnit: "m", temperature: "18", temperatureUnit: "°C" }],
      },
      warnings: [],
    });
    mockedWriteLogbook.mockImplementationOnce(async (updated) => updated);
    const formData = new FormData();
    formData.set("boatId", "boat-1");
    formData.append("files", imageFile());

    const response = await POST(scannerRequest(formData));

    expect(response.status).toBe(200);
    const [[persistedLogbook]] = mockedWriteLogbook.mock.calls;
    expect(persistedLogbook.sheets[0].lines[0]).toEqual(expect.objectContaining({ windUnit: "bft", seaUnit: "m", tideUnit: "m", temperatureUnit: "°C" }));
  });
});

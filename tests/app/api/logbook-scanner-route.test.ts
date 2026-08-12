import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

vi.mock("../../../auth", () => ({
  auth: vi.fn(),
}));

vi.mock("../../../app/lib/logbook-store", () => ({
  readLogbook: vi.fn(),
  createLogSheetAggregate: vi.fn(),
  writeLogbook: vi.fn(),
}));

vi.mock("../../../app/lib/logbook-scanner/openai-provider", () => ({
  openAiScannerProvider: { extractLogbookDraft: vi.fn(), isConfigured: vi.fn() },
}));

vi.mock("../../../app/lib/users", () => ({
  findUserById: vi.fn(),
}));
vi.mock("../../../app/lib/demo/demo-policy", () => ({ isActiveDemoSandbox: vi.fn() }));
vi.mock("../../../app/lib/security/rate-limiter", async () => {
  const actual = await vi.importActual<typeof import("../../../app/lib/security/rate-limiter")>("../../../app/lib/security/rate-limiter");
  return { ...actual, consumeRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 9, retryAfter: 60, resetAt: new Date() }) };
});

const { auth } = await import("../../../auth");
const store = await import("../../../app/lib/logbook-store");
const { openAiScannerProvider } = await import("../../../app/lib/logbook-scanner/openai-provider");
const { findUserById } = await import("../../../app/lib/users");
const { isActiveDemoSandbox } = await import("../../../app/lib/demo/demo-policy");
const { consumeRateLimit } = await import("../../../app/lib/security/rate-limiter");
const { POST } = await import("../../../app/api/logbook/scanner/route");

const mockedAuth = auth as unknown as Mock;
const mockedReadLogbook = vi.mocked(store.readLogbook);
const mockedCreateLogSheetAggregate = vi.mocked(store.createLogSheetAggregate);
const mockedWriteLogbook = vi.mocked(store.writeLogbook);
const mockedScanner = vi.mocked(openAiScannerProvider.extractLogbookDraft);
const mockedScannerConfigured = vi.mocked(openAiScannerProvider.isConfigured);
const mockedFindUserById = vi.mocked(findUserById);
const mockedIsActiveDemoSandbox = vi.mocked(isActiveDemoSandbox);
const mockedConsumeRateLimit = vi.mocked(consumeRateLimit);
const session = { user: { id: "user-1", name: "User", email: "user@example.test", groups: [] }, expires: "2099-01-01T00:00:00.000Z" };
const boat = { id: "boat-1", name: "Aurora", type: "Sail" as const, registration: "", flagState: "", homePort: "", owner: "", dimensions: "", logfactor: 1, yachtData: {}, deviationTable: [] };
const logbook = { boats: [boat], crewMembers: [], sheets: [] };
const partialScannerResult = {
  draft: {
    title: "",
    dateText: "2026-07-03",
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
    mockedIsActiveDemoSandbox.mockResolvedValue(false);
    mockedConsumeRateLimit.mockResolvedValue({ allowed: true, remaining: 9, retryAfter: 60, resetAt: new Date() });
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

  it("returns 429 with retry timing when the user quota is exhausted", async () => {
    mockedAuth.mockResolvedValueOnce(session);
    mockedConsumeRateLimit.mockResolvedValueOnce({ allowed: false, remaining: 0, retryAfter: 37, resetAt: new Date() });
    const response = await POST(scannerRequest(new FormData()));
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("37");
    expect(mockedReadLogbook).not.toHaveBeenCalled();
  });

  it("blocks demo sessions before reading or uploading image data", async () => {
    mockedAuth.mockResolvedValueOnce(session);
    mockedIsActiveDemoSandbox.mockResolvedValueOnce(true);
    const formData = new FormData();
    formData.append("boatId", "boat-1");
    formData.append("files", imageFile());

    const response = await POST(scannerRequest(formData));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ code: "demo_feature_unavailable", error: "Logbook scanning is available after registration and is disabled in demo sessions." });
    expect(mockedReadLogbook).not.toHaveBeenCalled();
    expect(mockedScanner).not.toHaveBeenCalled();
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

  it("rejects archived boats", async () => {
    mockedAuth.mockResolvedValueOnce(session);
    mockedReadLogbook.mockResolvedValueOnce({ ...logbook, boats: [{ ...boat, archived: true }] });
    const formData = new FormData();
    formData.set("boatId", boat.id);
    formData.append("files", imageFile());

    const response = await POST(scannerRequest(formData));

    expect(response.status).toBe(404);
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
      draft: { title: "", dateText: "", route: { from: "", to: "", departed: "", arrived: "" }, lines: [] },
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
    const unrelatedImage = { id: "unrelated-image", data: "data:image/png;base64,dW5yZWxhdGVk", mimeType: "image/png", width: 1, height: 1 };
    mockedReadLogbook.mockResolvedValueOnce({
      boats: [boat, { ...boat, id: "unrelated-boat", name: "Elsewhere", imageId: unrelatedImage.id, image: unrelatedImage }],
      crewMembers: [{ id: "unrelated-crew", name: "Other crew", nationality: "", role: "", address: "", certificate: "", imageId: unrelatedImage.id, image: unrelatedImage }],
      sheets: [{
        id: "unrelated-sheet", title: "Existing trip", status: "Draft", boatId: boat.id,
        route: { from: "X", to: "Y", departed: "", arrived: "" }, crew: [], watchPlan: [], technicalChecks: [],
        imageId: unrelatedImage.id, image: unrelatedImage,
        lines: [{ id: "unrelated-line", time: "2026-01-01T00:00", position: "", latitude: 0, longitude: 0, logNm: 0, compassCourse: 0, waves: 0, barometer: 0, weather: "", weatherRemark: "", temperature: 0, temperatureUnit: "°C", windDirection: "", windStrength: 0, windUnit: "bft", seaUnit: "m", tide: 0, tideUnit: "m", moon: "", deviation: 0, magneticCourse: 0, variation: 0, trueCourse: 0, windDrift: 0, courseThroughWater: 0, currentDrift: 0, courseOverGround: 0, speedKn: 0, sailMiles: 0, sailNote: "", motorMiles: 0, motorHours: 0, motorNote: "", remarks: "" }],
      }],
    });
    mockedScanner.mockResolvedValueOnce(partialScannerResult);
    mockedCreateLogSheetAggregate.mockImplementationOnce(async (sheet, lines) => ({ ...sheet, lines }));
    const formData = new FormData();
    formData.set("boatId", "boat-1");
    formData.append("files", imageFile("sheet.png", 4));

    const response = await POST(scannerRequest(formData));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.sheetId).toEqual(expect.any(String));
    expect(mockedScanner).toHaveBeenCalledWith({
      languageHint: "en",
      files: [{ name: "sheet.png", type: "image/png", buffer: expect.any(Buffer) }],
    });
    expect(mockedCreateLogSheetAggregate).toHaveBeenCalledWith(expect.objectContaining({
        id: body.sheetId,
        boatId: "boat-1",
        status: "Draft",
        source: "scanner",
        title: "Scanned log sheet",
        scannerWarnings: partialScannerResult.warnings,
    }), [expect.objectContaining({ time: "2026-07-03T10:30", latitude: 47.5, remarks: "Smudged row" })], "user-1");

    const mutationPayload = mockedCreateLogSheetAggregate.mock.calls[0].slice(0, 2);
    expect(mutationPayload[0]).not.toHaveProperty("lines");
    expect(JSON.stringify(mutationPayload)).not.toContain("sheet.png");
    expect(JSON.stringify(mutationPayload)).not.toContain("buffer");
    expect(JSON.stringify(mutationPayload)).not.toMatch(/unrelated-(boat|crew|sheet|line|image)/);
    expect(mockedWriteLogbook).not.toHaveBeenCalled();
  });

  it("defaults missing scanner units from user preferences", async () => {
    mockedAuth.mockResolvedValueOnce(session);
    mockedReadLogbook.mockResolvedValueOnce(logbook);
    mockedFindUserById.mockResolvedValueOnce({ ...session.user, countryCode: "", language: "en", windUnit: "kn", waterHeightUnit: "ft", temperatureUnit: "°F", coordinateFormat: "decimal", distanceDisplayUnit: "off", defaultBoatId: "", defaultCrewMemberIds: [], theme: "light", isNavSlim: false, onboardingCompletedTasks: [], hasReadCompliance: false, showCourseConversionTable: true });
    mockedScanner.mockResolvedValueOnce({
      draft: {
        title: "",
        dateText: "2026-07-03",
        route: { from: "A", to: "B", departed: "2026-07-03, 10:00", arrived: "2026-07-03, 11:00" },
        lines: [{ time: "2026-07-03T10:30", windStrength: "12", windUnit: "", waves: "2", seaUnit: "", tide: "1", tideUnit: "", temperature: "70", temperatureUnit: "" }],
      },
      warnings: [],
    });
    mockedCreateLogSheetAggregate.mockImplementationOnce(async (sheet, lines) => ({ ...sheet, lines }));
    const formData = new FormData();
    formData.set("boatId", "boat-1");
    formData.append("files", imageFile());

    const response = await POST(scannerRequest(formData));

    expect(response.status).toBe(200);
    const [, lines] = mockedCreateLogSheetAggregate.mock.calls[0];
    expect(lines[0]).toEqual(expect.objectContaining({ windUnit: "kn", seaUnit: "ft", tideUnit: "ft", temperatureUnit: "°F" }));
  });

  it("preserves explicit scanner units instead of applying user preference defaults", async () => {
    mockedAuth.mockResolvedValueOnce(session);
    mockedReadLogbook.mockResolvedValueOnce(logbook);
    mockedFindUserById.mockResolvedValueOnce({ ...session.user, countryCode: "", language: "en", windUnit: "kn", waterHeightUnit: "ft", temperatureUnit: "°F", coordinateFormat: "decimal", distanceDisplayUnit: "off", defaultBoatId: "", defaultCrewMemberIds: [], theme: "light", isNavSlim: false, onboardingCompletedTasks: [], hasReadCompliance: false, showCourseConversionTable: true });
    mockedScanner.mockResolvedValueOnce({
      draft: {
        title: "",
        dateText: "2026-07-03",
        route: { from: "A", to: "B", departed: "2026-07-03, 10:00", arrived: "2026-07-03, 11:00" },
        lines: [{ time: "2026-07-03T10:30", windStrength: "4", windUnit: "bft", waves: "0.5", seaUnit: "m", tide: "0.2", tideUnit: "m", temperature: "18", temperatureUnit: "°C" }],
      },
      warnings: [],
    });
    mockedCreateLogSheetAggregate.mockImplementationOnce(async (sheet, lines) => ({ ...sheet, lines }));
    const formData = new FormData();
    formData.set("boatId", "boat-1");
    formData.append("files", imageFile());

    const response = await POST(scannerRequest(formData));

    expect(response.status).toBe(200);
    const [, lines] = mockedCreateLogSheetAggregate.mock.calls[0];
    expect(lines[0]).toEqual(expect.objectContaining({ windUnit: "bft", seaUnit: "m", tideUnit: "m", temperatureUnit: "°C" }));
  });
});

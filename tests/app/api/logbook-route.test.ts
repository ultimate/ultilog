import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import type { PersistedLogbook } from "../../../app/models/logbook";
import { LOGBOOK_LIMITS } from "../../../app/lib/validation/logbook";

vi.mock("../../../auth", () => ({
  auth: vi.fn(),
}));

vi.mock("../../../app/lib/logbook-store", () => ({
  readLogbook: vi.fn(),
  writeLogbook: vi.fn(),
}));
vi.mock("../../../app/lib/demo/demo-policy", () => ({ isActiveDemoSandbox: vi.fn() }));

const { auth } = await import("../../../auth");
const store = await import("../../../app/lib/logbook-store");
const { isActiveDemoSandbox } = await import("../../../app/lib/demo/demo-policy");
const { GET, PUT } = await import("../../../app/api/logbook/route");

const mockedAuth = auth as unknown as Mock;
const mockedReadLogbook = vi.mocked(store.readLogbook);
const mockedWriteLogbook = vi.mocked(store.writeLogbook);
const mockedIsActiveDemoSandbox = vi.mocked(isActiveDemoSandbox);
const session = { user: { id: "user-1", name: "User", email: "user@example.test", groups: [] }, expires: "2099-01-01T00:00:00.000Z" };
const image = { data: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).toString("base64"), mimeType: "image/png", width: 64, height: 32 };
const logbook = { boats: [], crewMembers: [], sheets: [] };

describe("logbook endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedIsActiveDemoSandbox.mockResolvedValue(false);
    mockedReadLogbook.mockResolvedValue(logbook);
  });

  it("requires authentication for reads", async () => {
    mockedAuth.mockResolvedValueOnce(null);

    const response = await GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(mockedReadLogbook).not.toHaveBeenCalled();
  });

  it("reads the current user's logbook", async () => {
    mockedAuth.mockResolvedValueOnce(session);
    mockedReadLogbook.mockResolvedValueOnce(logbook);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(logbook);
    expect(mockedReadLogbook).toHaveBeenCalledWith("user-1");
  });

  it("rejects invalid write payloads", async () => {
    mockedAuth.mockResolvedValueOnce(session);

    const response = await PUT(new Request("https://ultilog.test/api/logbook", {
      method: "PUT",
      body: JSON.stringify({ boats: [] }),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid logbook payload" });
    expect(mockedWriteLogbook).not.toHaveBeenCalled();
  });

  it("rejects an empty write body without throwing", async () => {
    mockedAuth.mockResolvedValueOnce(session);

    const response = await PUT(new Request("https://ultilog.test/api/logbook", {
      method: "PUT",
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid logbook payload" });
    expect(mockedWriteLogbook).not.toHaveBeenCalled();
  });

  it("rejects an oversized request before reading or parsing its body", async () => {
    mockedAuth.mockResolvedValueOnce(session);
    const request = new Request("https://ultilog.test/api/logbook", { method: "PUT", headers: { "content-length": String(LOGBOOK_LIMITS.requestBytes + 1) }, body: "not json" });
    const readSpy = vi.spyOn(request, "text");

    const response = await PUT(request);

    expect(response.status).toBe(413);
    expect(readSpy).not.toHaveBeenCalled();
  });

  it("returns 413 for count limits and accepts the boundary", async () => {
    mockedAuth.mockResolvedValue(session);
    mockedWriteLogbook.mockImplementation(async value => value);
    const boat = { id: "boat", name: "Boat", type: "Sail" as const, registration: "", flagState: "", homePort: "", owner: "", dimensions: "", logfactor: 1, yachtData: {}, deviationTable: [] };
    const atLimit = { ...logbook, boats: Array.from({ length: LOGBOOK_LIMITS.boats }, (_, i) => ({ ...boat, id: `boat-${i}` })) };
    expect((await PUT(new Request("https://ultilog.test/api/logbook", { method: "PUT", body: JSON.stringify(atLimit) }))).status).toBe(200);
    expect((await PUT(new Request("https://ultilog.test/api/logbook", { method: "PUT", body: JSON.stringify({ ...atLimit, boats: [...atLimit.boats, boat] }) }))).status).toBe(413);
  });

  it("rejects malformed nested values and unsupported or oversized images", async () => {
    mockedAuth.mockResolvedValue(session);
    const boat = { id: "boat", name: "Boat", type: "Sail", registration: "", flagState: "", homePort: "", owner: "", dimensions: "", logfactor: 1, yachtData: {}, deviationTable: [] };
    const malformed = { ...logbook, boats: [{ ...boat, engines: [{ id: "engine", name: 42, label: "Main", role: "propulsion" }] }] };
    expect((await PUT(new Request("https://ultilog.test/api/logbook", { method: "PUT", body: JSON.stringify(malformed) }))).status).toBe(400);
    const invalidMime = { ...logbook, boats: [{ ...boat, image: { ...image, mimeType: "image/svg+xml" } }] };
    expect((await PUT(new Request("https://ultilog.test/api/logbook", { method: "PUT", body: JSON.stringify(invalidMime) }))).status).toBe(400);
    const oversizedData = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.alloc(1024 * 1024)]).toString("base64");
    const oversized = { ...logbook, boats: [{ ...boat, image: { ...image, data: oversizedData } }] };
    expect((await PUT(new Request("https://ultilog.test/api/logbook", { method: "PUT", body: JSON.stringify(oversized) }))).status).toBe(413);
  });

  it("accepts individual strings immediately below their limit", async () => {
    mockedAuth.mockResolvedValueOnce(session);
    mockedWriteLogbook.mockImplementationOnce(async value => value);
    const boundary = { ...logbook, crewMembers: [{ id: "crew", name: "x".repeat(LOGBOOK_LIMITS.string), nationality: "", role: "" }] };
    expect((await PUT(new Request("https://ultilog.test/api/logbook", { method: "PUT", body: JSON.stringify(boundary) }))).status).toBe(200);
  });


  it("preserves image payloads when writing the current user's logbook", async () => {
    const imageLogbook: PersistedLogbook = {
      boats: [{ id: "boat-1", name: "Aurora", type: "Sail", registration: "", flagState: "", homePort: "", owner: "", dimensions: "", logfactor: 1, yachtData: {}, deviationTable: [], image }],
      crewMembers: [{ id: "crew-1", name: "Luca", nationality: "CH", role: "Skipper", address: "", certificate: "", isPrimary: true, image }],
      sheets: [{ id: "sheet-1", title: "Trip", status: "Draft", boatId: "boat-1", route: { from: "A", to: "B", departed: "", arrived: "" }, crew: [{ id: "crew-1", name: "Luca", nationality: "CH", role: "Skipper", address: "", certificate: "", isPrimary: true, embarkationDateTime: "", embarkationPosition: "", disembarkationDateTime: "", disembarkationPosition: "", image }], watchPlan: [], technicalChecks: [], image, lines: [] }],
    };
    mockedAuth.mockResolvedValueOnce(session);
    mockedWriteLogbook.mockResolvedValueOnce(imageLogbook);

    const response = await PUT(new Request("https://ultilog.test/api/logbook", {
      method: "PUT",
      body: JSON.stringify(imageLogbook),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(imageLogbook);
    expect(mockedWriteLogbook).toHaveBeenCalledWith(imageLogbook, "user-1");
  });

  it("writes the current user's logbook", async () => {
    mockedAuth.mockResolvedValueOnce(session);
    mockedWriteLogbook.mockResolvedValueOnce(logbook);

    const response = await PUT(new Request("https://ultilog.test/api/logbook", {
      method: "PUT",
      body: JSON.stringify(logbook),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(logbook);
    expect(mockedWriteLogbook).toHaveBeenCalledWith(logbook, "user-1");
  });

  it("rejects deleting a boat that is referenced by a persisted logsheet", async () => {
    const boat = { id: "boat-1", archived: false, name: "Aurora", type: "Sail" as const, registration: "", flagState: "", homePort: "", owner: "", dimensions: "", logfactor: 1, yachtData: {}, deviationTable: [] };
    const sheet = { id: "sheet-1", title: "Trip", status: "Draft" as const, boatId: boat.id, route: { from: "A", to: "B", departed: "", arrived: "" }, crew: [], watchPlan: [], technicalChecks: [], lines: [] };
    mockedAuth.mockResolvedValueOnce(session);
    mockedReadLogbook.mockResolvedValueOnce({ boats: [boat], crewMembers: [], sheets: [sheet] });

    const response = await PUT(new Request("https://ultilog.test/api/logbook", {
      method: "PUT",
      body: JSON.stringify({ boats: [], crewMembers: [], sheets: [] }),
    }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: "referenced_boat_deleted" });
    expect(mockedWriteLogbook).not.toHaveBeenCalled();
  });

  it("allows legacy boat and logsheet IDs to be normalized without treating the boat as deleted", async () => {
    const boat = { id: "legacy-boat", archived: false, name: "Aurora", type: "Sail" as const, registration: "CH-1", flagState: "", homePort: "", owner: "", dimensions: "", logfactor: 1, yachtData: {}, deviationTable: [] };
    const sheet = { id: "legacy-sheet", title: "Trip", status: "Draft" as const, boatId: boat.id, route: { from: "A", to: "B", departed: "", arrived: "" }, crew: [], watchPlan: [], technicalChecks: [], lines: [] };
    const normalized = { boats: [{ ...boat, id: "9adc47f1-0cd6-4298-b68a-80d6600e481b" }], crewMembers: [], sheets: [{ ...sheet, id: "95ed6e76-d127-4e9e-a653-b1fe28a29345", boatId: "9adc47f1-0cd6-4298-b68a-80d6600e481b" }] };
    mockedAuth.mockResolvedValueOnce(session);
    mockedReadLogbook.mockResolvedValueOnce({ boats: [boat], crewMembers: [], sheets: [sheet] });
    mockedWriteLogbook.mockResolvedValueOnce(normalized);

    const response = await PUT(new Request("https://ultilog.test/api/logbook", { method: "PUT", body: JSON.stringify(normalized) }));

    expect(response.status).toBe(200);
    expect(mockedWriteLogbook).toHaveBeenCalledWith(normalized, "user-1");
  });

  it("allows archiving and restoring a referenced boat", async () => {
    const boat = { id: "boat-1", archived: false, name: "Aurora", type: "Sail" as const, registration: "", flagState: "", homePort: "", owner: "", dimensions: "", logfactor: 1, yachtData: {}, deviationTable: [] };
    const sheet = { id: "sheet-1", title: "Trip", status: "Draft" as const, boatId: boat.id, route: { from: "A", to: "B", departed: "", arrived: "" }, crew: [], watchPlan: [], technicalChecks: [], lines: [] };
    const current = { boats: [boat], crewMembers: [], sheets: [sheet] };
    const archived = { ...current, boats: [{ ...boat, archived: true }] };
    mockedAuth.mockResolvedValue(session);
    mockedReadLogbook.mockResolvedValueOnce(current).mockResolvedValueOnce(archived);
    mockedWriteLogbook.mockImplementation(async (value) => value);

    expect((await PUT(new Request("https://ultilog.test/api/logbook", { method: "PUT", body: JSON.stringify(archived) }))).status).toBe(200);
    expect((await PUT(new Request("https://ultilog.test/api/logbook", { method: "PUT", body: JSON.stringify(current) }))).status).toBe(200);
  });

  it("rejects assigning an archived boat to a new logsheet", async () => {
    const boat = { id: "boat-1", archived: true, name: "Aurora", type: "Sail" as const, registration: "", flagState: "", homePort: "", owner: "", dimensions: "", logfactor: 1, yachtData: {}, deviationTable: [] };
    const next = { boats: [boat], crewMembers: [], sheets: [{ id: "sheet-1", title: "Trip", status: "Draft" as const, boatId: boat.id, route: { from: "", to: "", departed: "", arrived: "" }, crew: [], watchPlan: [], technicalChecks: [], lines: [] }] };
    mockedAuth.mockResolvedValueOnce(session);
    mockedReadLogbook.mockResolvedValueOnce({ boats: [boat], crewMembers: [], sheets: [] });

    const response = await PUT(new Request("https://ultilog.test/api/logbook", { method: "PUT", body: JSON.stringify(next) }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: "archived_boat_for_new_sheet" });
  });

  it("removes images and public sharing from demo writes", async () => {
    const demoLogbook: PersistedLogbook = {
      boats: [{ id: "boat-1", name: "Aurora", type: "Sail", registration: "", flagState: "", homePort: "", owner: "", dimensions: "", logfactor: 1, yachtData: {}, deviationTable: [], image }],
      crewMembers: [{ id: "crew-1", name: "Luca", nationality: "CH", role: "Skipper", image }],
      sheets: [{ id: "sheet-1", title: "Trip", status: "Draft", boatId: "boat-1", route: { from: "", to: "", departed: "", arrived: "" }, crew: [{ id: "crew-1", name: "Luca", nationality: "CH", role: "Skipper", embarkationDateTime: "", embarkationPosition: "", disembarkationDateTime: "", disembarkationPosition: "", image }], watchPlan: [], technicalChecks: [], image, lines: [], share: { masterData: "public", picture: "public", logLines: "public", metrics: "public", technicalLog: "public", skipper: "public", crew: "public" } }],
    };
    mockedAuth.mockResolvedValueOnce(session);
    mockedIsActiveDemoSandbox.mockResolvedValueOnce(true);
    mockedWriteLogbook.mockImplementationOnce(async (value) => value);

    const response = await PUT(new Request("https://ultilog.test/api/logbook", { method: "PUT", body: JSON.stringify(demoLogbook) }));
    const saved = await response.json() as PersistedLogbook;

    expect(saved.boats[0].image).toBeUndefined();
    expect(saved.crewMembers[0].image).toBeUndefined();
    expect(saved.sheets[0].image).toBeUndefined();
    expect(saved.sheets[0].crew[0].image).toBeUndefined();
    expect(Object.values(saved.sheets[0].share ?? {})).toEqual(Array(7).fill("private"));
  });
});

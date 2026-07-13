import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import type { PersistedLogbook } from "../../../app/models/logbook";

vi.mock("../../../auth", () => ({
  auth: vi.fn(),
}));

vi.mock("../../../app/lib/logbook-store", () => ({
  readLogbook: vi.fn(),
  writeLogbook: vi.fn(),
}));

const { auth } = await import("../../../auth");
const store = await import("../../../app/lib/logbook-store");
const { GET, PUT } = await import("../../../app/api/logbook/route");

const mockedAuth = auth as unknown as Mock;
const mockedReadLogbook = vi.mocked(store.readLogbook);
const mockedWriteLogbook = vi.mocked(store.writeLogbook);
const session = { user: { id: "user-1", name: "User", email: "user@example.test", groups: [] }, expires: "2099-01-01T00:00:00.000Z" };
const image = { data: "base64-image", mimeType: "image/png", width: 64, height: 32 };
const logbook = { boats: [], crewMembers: [], sheets: [] };

describe("logbook endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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


  it("preserves image payloads when writing the current user's logbook", async () => {
    const imageLogbook: PersistedLogbook = {
      boats: [{ id: "boat-1", name: "Aurora", type: "Sail", registration: "", flagState: "", homePort: "", owner: "", dimensions: "", logfactor: 1, yachtData: {}, deviationTable: [], image }],
      crewMembers: [{ id: "crew-1", name: "Luca", nationality: "CH", role: "Skipper", address: "", certificate: "", isPrimary: true, image }],
      sheets: [{ id: "sheet-1", title: "Trip", status: "Draft", dateRange: "2026-07-03", boatId: "boat-1", route: { from: "A", to: "B", departed: "", arrived: "" }, crew: [{ id: "crew-1", name: "Luca", nationality: "CH", role: "Skipper", address: "", certificate: "", isPrimary: true, embarkationDateTime: "", embarkationPosition: "", disembarkationDateTime: "", disembarkationPosition: "", image }], watchPlan: [], technicalChecks: [], image, lines: [] }],
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
});

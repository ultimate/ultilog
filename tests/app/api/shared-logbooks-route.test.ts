import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import type { LogSheet } from "../../../app/models/logbook";

vi.mock("../../../auth", () => ({
  auth: vi.fn(),
}));

vi.mock("../../../app/lib/logbook-store", () => ({
  readSharedLogSheet: vi.fn(),
}));

const { auth } = await import("../../../auth");
const store = await import("../../../app/lib/logbook-store");
const { GET } = await import("../../../app/api/shared/logbooks/[[...segments]]/route");

const mockedAuth = auth as unknown as Mock;
const mockedReadSharedLogSheet = vi.mocked(store.readSharedLogSheet);
const session = { user: { id: "viewer-1", name: "Viewer", email: "viewer@example.test", groups: [] }, expires: "2099-01-01T00:00:00.000Z" };
const sharedSheet = { sheet: { id: "sheet-1", title: "Shared passage", status: "Draft", boatId: "boat-1", route: { from: "A", to: "B", departed: "", arrived: "" }, crew: [], watchPlan: [], technicalChecks: [], lines: [] } satisfies LogSheet, boatName: "Aurora", ownerAvatar: "data:image/png;base64,b3duZXI=", showOwnerAvatarOnPrint: true };

async function getWithSegments(segments?: string[]) {
  return GET(new Request("https://ultilog.test/api/shared/logbooks"), {
    params: Promise.resolve({ segments }),
  });
}

describe("shared logbooks endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns not found when no sheet id is present", async () => {
    const response = await getWithSegments();

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Shared logbook not found" });
    expect(mockedAuth).not.toHaveBeenCalled();
    expect(mockedReadSharedLogSheet).not.toHaveBeenCalled();
  });

  it("reads a public shared sheet by sheet id", async () => {
    mockedAuth.mockResolvedValueOnce(null);
    mockedReadSharedLogSheet.mockResolvedValueOnce(sharedSheet);

    const response = await getWithSegments(["sheet-1"]);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(sharedSheet);
    expect(mockedReadSharedLogSheet).toHaveBeenCalledWith("sheet-1", false, undefined);
  });

  it("passes the owner id and authentication state for owner-scoped share URLs", async () => {
    mockedAuth.mockResolvedValueOnce(session);
    mockedReadSharedLogSheet.mockResolvedValueOnce(sharedSheet);

    const response = await getWithSegments(["owner-1", "sheet-1"]);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(sharedSheet);
    expect(mockedReadSharedLogSheet).toHaveBeenCalledWith("sheet-1", true, "owner-1");
  });

  it("returns not found for unknown shares", async () => {
    mockedAuth.mockResolvedValueOnce(session);
    mockedReadSharedLogSheet.mockResolvedValueOnce(undefined);

    const response = await getWithSegments(["sheet-missing"]);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Shared logbook not found" });
  });

  it("returns not found for malformed share URLs", async () => {
    const response = await getWithSegments(["too", "many", "segments"]);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Shared logbook not found" });
    expect(mockedReadSharedLogSheet).not.toHaveBeenCalled();
  });
});

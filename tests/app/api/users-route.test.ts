import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

vi.mock("../../../auth", () => ({
  auth: vi.fn(),
}));

vi.mock("../../../app/lib/users", () => ({
  listUsersForDirectory: vi.fn(),
}));

const { auth } = await import("../../../auth");
const users = await import("../../../app/lib/users");
const { GET } = await import("../../../app/api/users/route");

const mockedAuth = auth as unknown as Mock;
const mockedListUsersForDirectory = vi.mocked(users.listUsersForDirectory);

const session = { user: { id: "user-1" }, expires: "2099-01-01T00:00:00.000Z" };

describe("users directory endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns unauthorized when no user is signed in", async () => {
    mockedAuth.mockResolvedValueOnce(null);

    const response = await GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(mockedListUsersForDirectory).not.toHaveBeenCalled();
  });

  it("lists real users for signed-in users", async () => {
    const listedUsers = [{ id: "user-1", username: "Sailor", sailMiles: 12.5, motorMiles: 3, logbookSheets: 2, boats: 1 }];
    mockedAuth.mockResolvedValueOnce(session);
    mockedListUsersForDirectory.mockResolvedValueOnce(listedUsers);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ users: listedUsers });
    expect(mockedListUsersForDirectory).toHaveBeenCalledWith();
  });
});

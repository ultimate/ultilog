import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../app/lib/users", () => ({
  userHasGroup: vi.fn(),
}));

const users = await import("../../../app/lib/users");
const { userHasEntitlement } = await import("../../../app/lib/authorization");
const mockedUserHasGroup = vi.mocked(users.userHasGroup);

describe("authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps user-management access to the current admin group", async () => {
    mockedUserHasGroup.mockResolvedValueOnce(true);

    await expect(userHasEntitlement("user-1", "admin:manage-users")).resolves.toBe(true);
    expect(mockedUserHasGroup).toHaveBeenCalledWith("user-1", "admin");
  });

  it("denies an entitlement when the current group is absent", async () => {
    mockedUserHasGroup.mockResolvedValueOnce(false);

    await expect(userHasEntitlement("user-1", "admin:manage-users")).resolves.toBe(false);
  });
});

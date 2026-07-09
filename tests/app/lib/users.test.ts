import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const tempDirs: string[] = [];

afterEach(async () => {
  vi.resetModules();
  delete process.env.LOCAL_DATABASE_PATH;
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })));
});

describe("users preferences", () => {
  it("returns defaults for a newly registered user", async () => {
    const { registerUser } = await importUsersWithTempDatabase();

    const user = await registerUser({ name: "Preference User", email: "preference@example.test", password: "password123" });

    expect(user).toMatchObject({
      countryCode: "",
      language: "en",
      windUnit: "bft",
      waterHeightUnit: "m",
      temperatureUnit: "c",
      coordinateFormat: "dm",
      distanceDisplayUnit: "nm",
      defaultBoatId: "",
      defaultCrewMemberIds: [],
      theme: "light",
      isNavSlim: false,
      showCourseConversionTable: true,
    });
  });

  it("validates and persists the full preference object", async () => {
    const { findUserById, registerUser, updateUserViewPreferences } = await importUsersWithTempDatabase();
    const user = await registerUser({ name: "Persist User", email: "persist@example.test", password: "password123" });

    const updated = await updateUserViewPreferences(user.id, {
      countryCode: " us ",
      language: "fr",
      windUnit: "kn",
      waterHeightUnit: "ft",
      temperatureUnit: "f",
      coordinateFormat: "dms",
      distanceDisplayUnit: "mi",
      defaultBoatId: " boat-1 ",
      defaultCrewMemberIds: ["crew-1", "crew-1", " ", 1],
      theme: "auto",
      isNavSlim: true,
      showCourseConversionTable: false,
    });

    expect(updated).toMatchObject({
      countryCode: "US",
      language: "fr",
      windUnit: "kn",
      waterHeightUnit: "ft",
      temperatureUnit: "f",
      coordinateFormat: "dms",
      distanceDisplayUnit: "mi",
      defaultBoatId: "boat-1",
      defaultCrewMemberIds: ["crew-1"],
      theme: "auto",
      isNavSlim: true,
      showCourseConversionTable: false,
    });
    await expect(findUserById(user.id)).resolves.toMatchObject(updated);
  });

  it("rejects invalid preference enum values", async () => {
    const { registerUser, updateUserViewPreferences } = await importUsersWithTempDatabase();
    const user = await registerUser({ name: "Invalid User", email: "invalid@example.test", password: "password123" });

    await expect(updateUserViewPreferences(user.id, { windUnit: "mph" })).rejects.toThrow("Wind unit is not supported.");
    await expect(updateUserViewPreferences(user.id, { countryCode: "USA" })).rejects.toThrow("Country code must be a two-letter ISO country code.");
  });
});

async function importUsersWithTempDatabase() {
  vi.resetModules();
  const directory = await mkdtemp(join(tmpdir(), "ultilog-users-"));
  tempDirs.push(directory);
  process.env.LOCAL_DATABASE_PATH = join(directory, "ultilog.sqlite");
  return import("../../../app/lib/users");
}

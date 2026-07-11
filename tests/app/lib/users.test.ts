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
      temperatureUnit: "°C",
      coordinateFormat: "decimal",
      distanceDisplayUnit: "off",
      defaultBoatId: "",
      defaultCrewMemberIds: [],
      theme: "light",
      isNavSlim: false,
      showCourseConversionTable: true,
    });
  });


  it("creates only the primary crew profile for a newly registered user logbook", async () => {
    const { registerUser } = await importUsersWithTempDatabase();
    const { readLogbook } = await import("../../../app/lib/logbook-store");

    const user = await registerUser({ name: "Fresh User", email: "fresh@example.test", password: "password123" });

    await expect(readLogbook(user.id)).resolves.toEqual({
      boats: [],
      crewMembers: [{ id: "me", name: "Fresh User", nationality: "", role: "", address: "", certificate: "", isPrimary: true }],
      sheets: [],
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
      temperatureUnit: "°F",
      coordinateFormat: "dms",
      distanceDisplayUnit: "km",
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
      temperatureUnit: "°F",
      coordinateFormat: "dms",
      distanceDisplayUnit: "km",
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

describe("email verification", () => {
  it("verifies a registered user's email with a valid token", async () => {
    const { createHash } = await import("node:crypto");
    const { registerUser, verifyEmailWithToken } = await importUsersWithTempDatabase();
    const { getDatabase } = await import("../../../app/lib/logbook-store");
    const user = await registerUser({ name: "Verify User", email: "verify@example.test", password: "password123" });
    const db = getDatabase();
    const token = "raw-verification-token";
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await db.query("insert into email_verification_tokens (id, user_id, token_hash, expires_at) values (?, ?, ?, ?)", ["known-token", user.id, tokenHash, new Date(Date.now() + 60_000).toISOString()]);

    await verifyEmailWithToken(token);

    const rows = (await db.query<{ email_verified_at: string | null }>("select email_verified_at from users where id = ?", [user.id])).rows;
    expect(rows[0]?.email_verified_at).toEqual(expect.any(String));
  });

  it("only creates password reset tokens for verified email addresses", async () => {
    const { registerUser, requestPasswordReset } = await importUsersWithTempDatabase();
    const { getDatabase } = await import("../../../app/lib/logbook-store");
    const user = await registerUser({ name: "Reset Verify User", email: "reset-verify@example.test", password: "password123" });
    const db = getDatabase();

    await requestPasswordReset(user.email);
    await expect(db.query<{ count: number }>("select count(*) as count from password_reset_tokens where user_id = ?", [user.id])).resolves.toMatchObject({ rows: [{ count: 0 }] });

    await db.query("update users set email_verified_at = ? where id = ?", [new Date().toISOString(), user.id]);
    await requestPasswordReset(user.email);

    await expect(db.query<{ count: number }>("select count(*) as count from password_reset_tokens where user_id = ?", [user.id])).resolves.toMatchObject({ rows: [{ count: 1 }] });
  });
});

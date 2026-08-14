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
  it("builds a Gravatar fallback from a normalized SHA-256 email hash", async () => {
    const { gravatarAvatarUrl } = await importUsersWithTempDatabase();

    expect(gravatarAvatarUrl("  Sailor@Example.COM ")).toBe(
      "https://www.gravatar.com/avatar/c9f866bbdbc2ee575094e2ac4039c0d6ba20153b025ea723affb8abc152219b3?s=256&d=mp",
    );
  });

  it("returns the Gravatar fallback as the user's profile avatar", async () => {
    const { findUserById, gravatarAvatarUrl, registerUser } = await importUsersWithTempDatabase();
    const user = await registerUser({ name: "Avatar User", email: "avatar@example.test", password: "Harbor lantern atlas 2026" });

    await expect(findUserById(user.id)).resolves.toMatchObject({
      avatar: gravatarAvatarUrl("avatar@example.test"),
    });
  });

  it("stores uploaded profile pictures without encryption", async () => {
    const { findUserById, registerUser, updateUserAvatar } = await importUsersWithTempDatabase();
    const { getDatabase } = await import("../../../app/lib/logbook-store");
    const user = await registerUser({ name: "Picture User", email: "picture@example.test", password: "Harbor lantern atlas 2026" });
    const avatarData = Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString("base64");

    await updateUserAvatar(user.id, { data: avatarData, mimeType: "image/jpeg" });

    await expect(getDatabase().query<{ avatar_data: string; avatar_mime_type: string }>("select avatar_data, avatar_mime_type from users where id = ?", [user.id])).resolves.toMatchObject({
      rows: [{ avatar_data: avatarData, avatar_mime_type: "image/jpeg" }],
    });
    await expect(findUserById(user.id)).resolves.toMatchObject({ avatar: `data:image/jpeg;base64,${avatarData}` });
  });

  it("removes an uploaded picture and restores the Gravatar fallback", async () => {
    const { findUserById, gravatarAvatarUrl, registerUser, removeUserAvatar, updateUserAvatar } = await importUsersWithTempDatabase();
    const user = await registerUser({ name: "Remove Picture", email: "remove-picture@example.test", password: "Harbor lantern atlas 2026" });
    await updateUserAvatar(user.id, { data: Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString("base64"), mimeType: "image/jpeg" });

    await expect(removeUserAvatar(user.id)).resolves.toBe(gravatarAvatarUrl(user.email));
    await expect(findUserById(user.id)).resolves.toMatchObject({ avatar: gravatarAvatarUrl(user.email), hasUploadedAvatar: false });
  });

  it("returns defaults for a newly registered user", async () => {
    const { registerUser } = await importUsersWithTempDatabase();

    const user = await registerUser({ name: "Preference User", email: "preference@example.test", password: "Harbor lantern atlas 2026" });

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

    const user = await registerUser({ name: "Fresh User", email: "fresh@example.test", password: "Harbor lantern atlas 2026" });

    await expect(readLogbook(user.id)).resolves.toEqual({
      boats: [],
      crewMembers: [expect.objectContaining({ id: "me", name: "Fresh User", nationality: "", role: "", address: "", certificate: "", dateOfBirth: "", placeOfBirth: "", gender: "", identityDocumentType: "", identityDocumentNumber: "", identityDocumentIssuingDate: "", identityDocumentExpiryDate: "", isPrimary: true, revision: 1, createdAt: expect.any(String), updatedAt: expect.any(String) })],
      sheets: [],
    });
  });

  it("validates and persists the full preference object", async () => {
    const { findUserById, registerUser, updateUserViewPreferences } = await importUsersWithTempDatabase();
    const user = await registerUser({ name: "Persist User", email: "persist@example.test", password: "Harbor lantern atlas 2026" });

    const updated = await updateUserViewPreferences(user.id, {
      countryCode: " de ",
      language: "fr",
      dateFormat: "dd.MM.yyyy",
      timeFormat: "h:mm a",
      windUnit: "kn",
      waterHeightUnit: "ft",
      temperatureUnit: "°F",
      coordinateFormat: "ddm",
      distanceDisplayUnit: "km",
      defaultBoatId: " boat-1 ",
      defaultCrewMemberIds: ["crew-1", "crew-1", " ", 1],
      theme: "auto",
      isNavSlim: true,
      showCourseConversionTable: false,
    });

    expect(updated).toMatchObject({
      countryCode: "DE",
      language: "fr",
      dateFormat: "dd.MM.yyyy",
      timeFormat: "h:mm a",
      windUnit: "kn",
      waterHeightUnit: "ft",
      temperatureUnit: "°F",
      coordinateFormat: "ddm",
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
    const user = await registerUser({ name: "Invalid User", email: "invalid@example.test", password: "Harbor lantern atlas 2026" });

    await expect(updateUserViewPreferences(user.id, { windUnit: "mph" })).rejects.toThrow("Wind unit is not supported.");
    await expect(updateUserViewPreferences(user.id, { countryCode: "ZZ" })).rejects.toThrow("Country code must be a supported ISO country code.");
    await expect(updateUserViewPreferences(user.id, { countryCode: "CH" })).resolves.toMatchObject({ countryCode: "CH" });
    await expect(updateUserViewPreferences(user.id, { countryCode: "" })).resolves.toMatchObject({ countryCode: "" });
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
    const user = await registerUser({ name: "Verify User", email: "verify@example.test", password: "Harbor lantern atlas 2026" });
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
    const user = await registerUser({ name: "Reset Verify User", email: "reset-verify@example.test", password: "Harbor lantern atlas 2026" });
    const db = getDatabase();

    await requestPasswordReset(user.email);
    await expect(db.query<{ count: number }>("select count(*) as count from password_reset_tokens where user_id = ?", [user.id])).resolves.toMatchObject({ rows: [{ count: 0 }] });

    await db.query("update users set email_verified_at = ? where id = ?", [new Date().toISOString(), user.id]);
    await requestPasswordReset(user.email);

    await expect(db.query<{ count: number }>("select count(*) as count from password_reset_tokens where user_id = ?", [user.id])).resolves.toMatchObject({ rows: [{ count: 1 }] });
  });


  it("allows users to request another verification email immediately", async () => {
    const { registerUser, requestEmailVerification } = await importUsersWithTempDatabase();
    const { getDatabase } = await import("../../../app/lib/logbook-store");
    const user = await registerUser({ name: "Resend Verify User", email: "resend-verify@example.test", password: "Harbor lantern atlas 2026" });
    const db = getDatabase();

    await requestEmailVerification(user.email);

    await expect(db.query<{ count: number }>("select count(*) as count from email_verification_tokens where user_id = ?", [user.id])).resolves.toMatchObject({ rows: [{ count: 2 }] });
  });

  it("resends verification on login only when no active verification token remains", async () => {
    const { registerUser, validateUser } = await importUsersWithTempDatabase();
    const { getDatabase } = await import("../../../app/lib/logbook-store");
    const user = await registerUser({ name: "Login Verify User", email: "login-verify@example.test", password: "Harbor lantern atlas 2026" });
    const db = getDatabase();

    await expect(validateUser(user.email, "Harbor lantern atlas 2026")).resolves.toMatchObject({ id: user.id });
    await expect(db.query<{ count: number }>("select count(*) as count from email_verification_tokens where user_id = ?", [user.id])).resolves.toMatchObject({ rows: [{ count: 1 }] });

    await db.query("update email_verification_tokens set expires_at = ? where user_id = ?", [new Date(Date.now() - 60_000).toISOString(), user.id]);
    await expect(validateUser(user.email, "Harbor lantern atlas 2026")).resolves.toMatchObject({ id: user.id });

    await expect(db.query<{ count: number }>("select count(*) as count from email_verification_tokens where user_id = ?", [user.id])).resolves.toMatchObject({ rows: [{ count: 2 }] });
  });
});

describe("password policy enforcement", () => {
  it.each([
    ["too short", "Short phrase"],
    ["known compromised", "password123456789"],
    ["predictable", "aaaaaaaaaaaaaaaa"],
    ["over bcrypt's byte limit", "🚤".repeat(19)],
  ])("rejects %s passwords identically in registration, profile updates, and token resets", async (_case, password) => {
    const { registerUser, resetPasswordWithToken, updateUserPassword } = await importUsersWithTempDatabase();

    const attempts = [
      registerUser({ name: "Policy User", email: "policy@example.test", password }),
      updateUserPassword("any-user", { currentPassword: "irrelevant", newPassword: password }),
      resetPasswordWithToken("any-token", password),
    ];

    for (const attempt of attempts) {
      await expect(attempt).rejects.toMatchObject({
        name: "PasswordPolicyError",
        message: "Password does not meet the password policy.",
      });
    }
  });

  it("normalizes Unicode to NFC before storage and authentication", async () => {
    const { registerUser, validateUser } = await importUsersWithTempDatabase();
    const decomposed = "Cafe\u0301 harbor lantern 2026";
    const composed = decomposed.normalize("NFC");
    const user = await registerUser({ name: "Unicode User", email: "unicode@example.test", password: decomposed });

    await expect(validateUser(user.email, composed)).resolves.toMatchObject({ id: user.id });
  });

  it("permits long passphrases and password-manager generated credentials without composition rules", async () => {
    const { registerUser } = await importUsersWithTempDatabase();

    await expect(registerUser({ name: "Phrase User", email: "phrase@example.test", password: "four quiet boats cross midnight" })).resolves.toMatchObject({ email: "phrase@example.test" });
    await expect(registerUser({ name: "Manager User", email: "manager@example.test", password: "vB4!q9_Zx7@Lp2#Nm8$Kr5" })).resolves.toMatchObject({ email: "manager@example.test" });
  });
});

describe("password session invalidation", () => {
  it("allows only one concurrent request to consume a reset token", async () => {
    const { createHash } = await import("node:crypto");
    const { getUserSessionVersion, registerUser, resetPasswordWithToken } = await importUsersWithTempDatabase();
    const { getDatabase } = await import("../../../app/lib/logbook-store");
    const user = await registerUser({ name: "Concurrent Reset", email: "concurrent-reset@example.test", password: "Harbor lantern atlas 2026" });
    const token = "single-use-reset-token";
    await getDatabase().query(
      "insert into password_reset_tokens (id, user_id, token_hash, expires_at) values (?, ?, ?, ?)",
      ["concurrent-token", user.id, createHash("sha256").update(token).digest("hex"), new Date(Date.now() + 60_000).toISOString()],
    );

    const results = await Promise.allSettled([
      resetPasswordWithToken(token, "First replacement phrase 2026"),
      resetPasswordWithToken(token, "Second replacement phrase 2026"),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    await expect(getUserSessionVersion(user.id)).resolves.toBe(1);
  });

  it("rejects the prior session version after a profile password change", async () => {
    const { registerUser, updateUserPassword } = await importUsersWithTempDatabase();
    const { getUserSessionVersion } = await import("../../../app/lib/users");
    const user = await registerUser({ name: "Profile Password", email: "profile-password@example.test", password: "Harbor lantern atlas 2026" });
    const issuedVersion = user.sessionVersion ?? 0;

    await expect(getUserSessionVersion(user.id)).resolves.toBe(issuedVersion);
    await updateUserPassword(user.id, { currentPassword: "Harbor lantern atlas 2026", newPassword: "Fresh profile password 2026" });
    await expect(getUserSessionVersion(user.id)).resolves.not.toBe(issuedVersion);
  });

  it("rejects the prior session version after a token password reset", async () => {
    const { createHash } = await import("node:crypto");
    const { registerUser, resetPasswordWithToken } = await importUsersWithTempDatabase();
    const { getDatabase } = await import("../../../app/lib/logbook-store");
    const { getUserSessionVersion } = await import("../../../app/lib/users");
    const user = await registerUser({ name: "Token Password", email: "token-password@example.test", password: "Harbor lantern atlas 2026" });
    const token = "session-invalidating-token";
    await getDatabase().query(
      "insert into password_reset_tokens (id, user_id, token_hash, expires_at) values (?, ?, ?, ?)",
      ["session-token", user.id, createHash("sha256").update(token).digest("hex"), new Date(Date.now() + 60_000).toISOString()],
    );

    await resetPasswordWithToken(token, "Fresh token password 2026");

    await expect(getUserSessionVersion(user.id)).resolves.not.toBe(user.sessionVersion ?? 0);
  });
});

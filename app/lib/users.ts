import { createHash, randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { isOnboardingTaskId, type OnboardingTaskId } from "./onboarding/tasks";
import { getDatabase, writeLogbook } from "./logbook-store";
import { sendEmailVerificationEmail, sendPasswordResetEmail } from "./mailer";

export type UserTheme = "light" | "dark" | "auto";
export type UserPreferences = {
  countryCode: string;
  language: "en" | "de" | "fr" | "it";
  windUnit: "bft" | "kn" | "km/h" | "mp/h" | "m/s";
  waterHeightUnit: "m" | "ft";
  temperatureUnit: "°C" | "°F";
  coordinateFormat: "decimal" | "dms";
  distanceDisplayUnit: "off" | "m" | "km";
  defaultBoatId: string;
  defaultCrewMemberIds: string[];
  theme: UserTheme;
  isNavSlim: boolean;
  showCourseConversionTable: boolean;
  motionStationaryThresholdNm?: number;
};
export type AppUser = { id: string; name: string; email: string; emailVerified?: boolean; groups: string[]; onboardingCompletedTasks: OnboardingTaskId[]; hasReadCompliance: boolean } & UserPreferences;
export type AdminUserListItem = AppUser;
export type DirectoryUserListItem = { id: string; username: string; sailMiles: number; motorMiles: number; logbookSheets: number; boats: number };

type UserRow = Omit<AppUser, "groups" | "onboardingCompletedTasks" | "hasReadCompliance" | "isNavSlim" | "countryCode" | "windUnit" | "waterHeightUnit" | "temperatureUnit" | "coordinateFormat" | "distanceDisplayUnit" | "defaultBoatId" | "defaultCrewMemberIds" | "showCourseConversionTable" | "motionStationaryThresholdNm" | "emailVerified"> & { password_hash: string; onboarding_completed_tasks: string; country_code: string; wind_unit: string; water_height_unit: string; temperature_unit: string; coordinate_format: string; distance_display_unit: string; default_boat_id: string; default_crew_member_ids: string; nav_slim: number | boolean; has_read_compliance: number | boolean; show_course_conversion_table: number | boolean; motion_stationary_threshold_nm: number | string | null; email_verified_at: string | null };
type GroupRow = { user_id?: string; name: string };
type PasswordResetTokenRow = { id: string; user_id: string; token_hash: string; expires_at: string; used_at: string | null };
type EmailVerificationTokenRow = PasswordResetTokenRow;
type DirectoryUserRow = { id: string; username: string; sail_miles: number | string | null; motor_miles: number | string | null; logbook_sheets: number | string | null; boats: number | string | null };

const USER_COLUMNS = "id, name, email, password_hash, onboarding_completed_tasks, theme, nav_slim, has_read_compliance, country_code, language, wind_unit, water_height_unit, temperature_unit, coordinate_format, distance_display_unit, default_boat_id, default_crew_member_ids, show_course_conversion_table, motion_stationary_threshold_nm, email_verified_at";

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const passwordResetTokenHours = 1;
const emailVerificationTokenHours = 24;
const blockedNameTerms = ["admin", "ultilog", "support", "moderator", "fuck", "shit", "bitch", "asshole", "cunt", "nigger", "nazi"];

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function buildPasswordResetUrl(token: string) {
  return new URL(`/reset-password?token=${encodeURIComponent(token)}`, appBaseUrl()).toString();
}

function buildEmailVerificationUrl(token: string) {
  return new URL(`/verify-email?token=${encodeURIComponent(token)}`, appBaseUrl()).toString();
}

function appBaseUrl() {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_BRANCH_URL || process.env.AUTH_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
  return withProtocol(configuredBaseUrl);
}

function withProtocol(url: string) {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function normalizeGroupName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, "-");
}

function normalizeGroups(groups: string[]) {
  return [...new Set(groups.map(normalizeGroupName).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function normalizeOnboardingCompletedTasks(tasks: unknown): OnboardingTaskId[] {
  if (!Array.isArray(tasks)) return [];
  return [...new Set(tasks.filter(isOnboardingTaskId))];
}

function parseOnboardingCompletedTasks(value: string | null | undefined): OnboardingTaskId[] {
  if (!value) return [];
  try {
    return normalizeOnboardingCompletedTasks(JSON.parse(value));
  } catch {
    return [];
  }
}

function serializeOnboardingCompletedTasks(tasks: unknown) {
  return JSON.stringify(normalizeOnboardingCompletedTasks(tasks));
}

function normalizeTheme(theme: unknown): UserTheme {
  return theme === "dark" || theme === "auto" ? theme : "light";
}

function normalizeBooleanFlag(value: unknown) {
  return value === true || value === 1;
}

function normalizeStringList(value: unknown): string[] {
  if (Array.isArray(value)) return [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))];
  if (typeof value !== "string" || !value) return [];
  try {
    return normalizeStringList(JSON.parse(value));
  } catch {
    return [];
  }
}

function normalizeCountryCode(value: unknown) {
  if (typeof value !== "string") return "";
  const countryCode = value.trim().toUpperCase();
  if (!countryCode) return "";
  if (!/^[A-Z]{2}$/.test(countryCode)) throw new Error("Country code must be a two-letter ISO country code.");
  return countryCode;
}

function normalizeEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T, label: string, strict = false): T {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "string" && (allowed as readonly string[]).includes(value)) return value as T;
  if (strict) throw new Error(`${label} is not supported.`);
  return fallback;
}

function normalizeUserPreferences(input: Partial<Record<keyof UserPreferences, unknown>>, current?: UserRow, strict = false): UserPreferences {
  const currentUser = current ? toAppUser(current, []) : undefined;
  return {
    countryCode: input.countryCode === undefined ? currentUser?.countryCode ?? "" : normalizeCountryCode(input.countryCode),
    language: normalizeEnum(input.language, ["en", "de", "fr", "it"] as const, currentUser?.language ?? "en", "Language", strict),
    windUnit: normalizeEnum(input.windUnit, ["bft", "kn", "km/h", "mp/h", "m/s"] as const, currentUser?.windUnit ?? "bft", "Wind unit", strict),
    waterHeightUnit: normalizeEnum(input.waterHeightUnit, ["m", "ft"] as const, currentUser?.waterHeightUnit ?? "m", "Water height unit", strict),
    temperatureUnit: normalizeEnum(input.temperatureUnit, ["°C", "°F"] as const, currentUser?.temperatureUnit ?? "°C", "Temperature unit", strict),
    coordinateFormat: normalizeEnum(input.coordinateFormat, ["decimal", "dms"] as const, currentUser?.coordinateFormat ?? "decimal", "Coordinate format", strict),
    distanceDisplayUnit: normalizeEnum(input.distanceDisplayUnit, ["off", "m", "km"] as const, currentUser?.distanceDisplayUnit ?? "off", "Distance display unit", strict),
    defaultBoatId: typeof input.defaultBoatId === "string" ? input.defaultBoatId.trim() : currentUser?.defaultBoatId ?? "",
    defaultCrewMemberIds: input.defaultCrewMemberIds === undefined ? currentUser?.defaultCrewMemberIds ?? [] : normalizeStringList(input.defaultCrewMemberIds),
    theme: normalizeEnum(input.theme, ["light", "dark", "auto"] as const, currentUser?.theme ?? "light", "Theme", strict),
    isNavSlim: input.isNavSlim === undefined ? currentUser?.isNavSlim ?? false : Boolean(input.isNavSlim),
    showCourseConversionTable: input.showCourseConversionTable === undefined ? currentUser?.showCourseConversionTable ?? true : Boolean(input.showCourseConversionTable),
    motionStationaryThresholdNm: normalizeNonNegativeNumber(input.motionStationaryThresholdNm, currentUser?.motionStationaryThresholdNm ?? 0.1, "Motion threshold", strict),
  };
}

function normalizeNonNegativeNumber(value: unknown, fallback: number, label: string, strict = false) {
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(value);
  if (Number.isFinite(number) && number >= 0) return number;
  if (strict) throw new Error(`${label} must be a non-negative number.`);
  return fallback;
}

function toAppUser(user: UserRow, groups: string[]): AppUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: Boolean(user.email_verified_at),
    groups,
    onboardingCompletedTasks: parseOnboardingCompletedTasks(user.onboarding_completed_tasks),
    theme: normalizeTheme(user.theme),
    isNavSlim: normalizeBooleanFlag(user.nav_slim),
    hasReadCompliance: normalizeBooleanFlag(user.has_read_compliance),
    countryCode: user.country_code ?? "",
    language: normalizeEnum(user.language, ["en", "de", "fr", "it"] as const, "en", "Language"),
    windUnit: normalizeEnum(user.wind_unit, ["bft", "kn", "km/h", "mp/h", "m/s"] as const, "bft", "Wind unit"),
    waterHeightUnit: normalizeEnum(user.water_height_unit, ["m", "ft"] as const, "m", "Water height unit"),
    temperatureUnit: normalizeEnum(user.temperature_unit, ["°C", "°F"] as const, "°C", "Temperature unit"),
    coordinateFormat: normalizeEnum(user.coordinate_format, ["decimal", "dms"] as const, "decimal", "Coordinate format"),
    distanceDisplayUnit: normalizeEnum(user.distance_display_unit, ["off", "m", "km"] as const, "off", "Distance display unit"),
    defaultBoatId: user.default_boat_id ?? "",
    defaultCrewMemberIds: normalizeStringList(user.default_crew_member_ids),
    showCourseConversionTable: normalizeBooleanFlag(user.show_course_conversion_table ?? true),
    motionStationaryThresholdNm: normalizeNonNegativeNumber(user.motion_stationary_threshold_nm, 0.1, "Motion threshold"),
  };
}

function assertAllowedName(name: string) {
  if (name.length < 2) throw new Error("Name must be at least 2 characters.");
  if (name.length > 80) throw new Error("Name must be 80 characters or less.");
  if (!/^[\p{L}\p{M}0-9 .'-]+$/u.test(name)) throw new Error("Name can only contain letters, numbers, spaces, dots, apostrophes, and hyphens.");
  const folded = name.toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (blockedNameTerms.some((term) => folded.includes(term))) throw new Error("Choose a different display name.");
}

function assertAllowedGroupName(name: string) {
  if (name.length < 1) throw new Error("Group names cannot be empty.");
  if (name.length > 40) throw new Error("Group names must be 40 characters or less.");
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) throw new Error("Group names may only contain lowercase letters, numbers, and hyphens.");
}

// These are manually assigned, non-expiring groups. Derived access such as a
// subscription or trial belongs in its own store and is combined by the
// authorization layer rather than written to user_groups.
async function manualGroupsForUser(userId: string) {
  const db = getDatabase();
  await db.migrate();
  const result = await db.query<GroupRow>(`select name from user_groups where user_id = ${db.placeholder(1)} order by name`, [userId]);
  return result.rows.map((row) => row.name);
}

async function withGroups(user: UserRow | undefined): Promise<AppUser | undefined> {
  if (!user) return undefined;
  return toAppUser(user, await manualGroupsForUser(user.id));
}

async function findUserByName(name: string) {
  const db = getDatabase();
  await db.migrate();
  const result = await db.query<UserRow>(`select ${USER_COLUMNS} from users where lower(name) = lower(${db.placeholder(1)})`, [normalizeName(name)]);
  return result.rows[0];
}

export async function findUserByEmail(email: string) {
  const db = getDatabase();
  await db.migrate();
  const result = await db.query<UserRow>(`select ${USER_COLUMNS} from users where email = ${db.placeholder(1)}`, [normalizeEmail(email)]);
  return withGroups(result.rows[0]);
}

export async function findUserById(userId: string) {
  const db = getDatabase();
  await db.migrate();
  const result = await db.query<UserRow>(`select ${USER_COLUMNS} from users where id = ${db.placeholder(1)}`, [userId]);
  return withGroups(result.rows[0]);
}

async function findUserRowByEmail(email: string) {
  const db = getDatabase();
  await db.migrate();
  const result = await db.query<UserRow>(`select ${USER_COLUMNS} from users where email = ${db.placeholder(1)}`, [normalizeEmail(email)]);
  return result.rows[0];
}

export async function validateUser(email: string, password: string): Promise<AppUser | null> {
  const user = await findUserRowByEmail(email);
  if (!user?.password_hash) return null;
  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) return null;
  if (!user.email_verified_at) await sendEmailVerificationIfNeeded(user);
  return toAppUser(user, await manualGroupsForUser(user.id));
}

export function isAdminUser(user?: { groups?: string[] } | null) {
  return user?.groups?.includes("admin") ?? false;
}

export async function userHasGroup(userId: string, group: string) {
  return (await manualGroupsForUser(userId)).includes(normalizeGroupName(group));
}

export async function registerUser(input: { name: string; email: string; password: string }): Promise<AppUser> {
  const name = normalizeName(input.name);
  const email = normalizeEmail(input.email);
  assertAllowedName(name);
  if (!email.includes("@")) throw new Error("Enter a valid email address.");
  if (input.password.length < 8) throw new Error("Password must be at least 8 characters.");
  if (await findUserByEmail(email)) throw new Error("An account with this email already exists.");
  if (await findUserByName(name)) throw new Error("An account with this name already exists.");

  const user: AppUser = { id: randomUUID(), name, email, emailVerified: false, groups: [], onboardingCompletedTasks: [], hasReadCompliance: false, ...normalizeUserPreferences({}) };
  const passwordHash = await bcrypt.hash(input.password, 10);
  const db = getDatabase();
  await db.query(
    `insert into users (id, name, email, password_hash) values (${db.placeholder(1)}, ${db.placeholder(2)}, ${db.placeholder(3)}, ${db.placeholder(4)})`,
    [user.id, user.name, user.email, passwordHash],
  );
  await sendEmailVerification(user.id);
  await writeLogbook({ boats: [], crewMembers: [{ id: "me", name: user.name, nationality: "", role: "", address: "", certificate: "", isPrimary: true }], sheets: [] }, user.id);
  return user;
}

export async function updateUserEmail(userId: string, input: { email: string; currentPassword: string }): Promise<AppUser> {
  const email = normalizeEmail(input.email);
  if (!email.includes("@")) throw new Error("Enter a valid email address.");
  const db = getDatabase();
  await db.migrate();
  const current = (await db.query<UserRow>(`select ${USER_COLUMNS} from users where id = ${db.placeholder(1)}`, [userId])).rows[0];
  if (!current) throw new Error("User not found.");
  if (!await bcrypt.compare(input.currentPassword, current.password_hash)) throw new Error("Current password is incorrect.");
  const existing = await findUserByEmail(email);
  if (existing && existing.id !== userId) throw new Error("An account with this email already exists.");
  await db.query(`update users set email = ${db.placeholder(1)}, email_verified_at = null where id = ${db.placeholder(2)}`, [email, userId]);
  await sendEmailVerification(userId);
  return toAppUser({ ...current, email, email_verified_at: null }, await manualGroupsForUser(userId));
}

export async function updateUserPassword(userId: string, input: { currentPassword: string; newPassword: string }): Promise<void> {
  if (input.newPassword.length < 8) throw new Error("Password must be at least 8 characters.");
  const db = getDatabase();
  await db.migrate();
  const current = (await db.query<UserRow>(`select ${USER_COLUMNS} from users where id = ${db.placeholder(1)}`, [userId])).rows[0];
  if (!current) throw new Error("User not found.");
  if (!await bcrypt.compare(input.currentPassword, current.password_hash)) throw new Error("Current password is incorrect.");
  const passwordHash = await bcrypt.hash(input.newPassword, 10);
  await db.query(`update users set password_hash = ${db.placeholder(1)} where id = ${db.placeholder(2)}`, [passwordHash, userId]);
}

export async function requestPasswordReset(emailInput: string): Promise<void> {
  const email = normalizeEmail(emailInput);
  const db = getDatabase();
  await db.migrate();
  const current = (await db.query<UserRow>(`select ${USER_COLUMNS} from users where email = ${db.placeholder(1)}`, [email])).rows[0];
  if (!current?.email_verified_at) return;

  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + passwordResetTokenHours * 60 * 60 * 1000).toISOString();
  await db.query(
    `insert into password_reset_tokens (id, user_id, token_hash, expires_at) values (${db.placeholder(1)}, ${db.placeholder(2)}, ${db.placeholder(3)}, ${db.placeholder(4)})`,
    [randomUUID(), current.id, tokenHash, expiresAt],
  );
  await sendPasswordResetEmail({ to: current.email, resetUrl: buildPasswordResetUrl(token), locale: current.language });
}

async function sendEmailVerificationIfNeeded(user: UserRow): Promise<void> {
  if (user.email_verified_at) return;
  const db = getDatabase();
  await db.migrate();
  const activeToken = (await db.query<EmailVerificationTokenRow>(
    `select id, user_id, token_hash, expires_at, used_at from email_verification_tokens where user_id = ${db.placeholder(1)} and used_at is null and expires_at > ${db.placeholder(2)} order by expires_at desc`,
    [user.id, new Date().toISOString()],
  )).rows[0];
  if (activeToken) return;
  await sendEmailVerification(user.id);
}

async function sendEmailVerification(userId: string): Promise<void> {
  const db = getDatabase();
  await db.migrate();
  const current = (await db.query<UserRow>(`select ${USER_COLUMNS} from users where id = ${db.placeholder(1)}`, [userId])).rows[0];
  if (!current) throw new Error("User not found.");

  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + emailVerificationTokenHours * 60 * 60 * 1000).toISOString();
  await db.query(
    `insert into email_verification_tokens (id, user_id, token_hash, expires_at) values (${db.placeholder(1)}, ${db.placeholder(2)}, ${db.placeholder(3)}, ${db.placeholder(4)})`,
    [randomUUID(), current.id, tokenHash, expiresAt],
  );
  await sendEmailVerificationEmail({ to: current.email, verificationUrl: buildEmailVerificationUrl(token), locale: current.language });
}

export async function verifyEmailWithToken(token: string): Promise<void> {
  const db = getDatabase();
  await db.migrate();
  const tokenHash = hashToken(token.trim());
  const verificationToken = (await db.query<EmailVerificationTokenRow>(
    `select id, user_id, token_hash, expires_at, used_at from email_verification_tokens where token_hash = ${db.placeholder(1)}`,
    [tokenHash],
  )).rows[0];
  if (!verificationToken || verificationToken.used_at) throw new Error("This email verification link is invalid or has already been used.");
  if (new Date(verificationToken.expires_at).getTime() <= Date.now()) throw new Error("This email verification link has expired.");

  const verifiedAt = new Date().toISOString();
  await db.query(`update users set email_verified_at = ${db.placeholder(1)} where id = ${db.placeholder(2)}`, [verifiedAt, verificationToken.user_id]);
  await db.query(`update email_verification_tokens set used_at = ${db.placeholder(1)} where id = ${db.placeholder(2)}`, [verifiedAt, verificationToken.id]);
}

export async function requestEmailVerification(emailInput: string): Promise<void> {
  const email = normalizeEmail(emailInput);
  const current = await findUserRowByEmail(email);
  if (!current || current.email_verified_at) return;
  await sendEmailVerification(current.id);
}

export async function resetPasswordWithToken(token: string, newPassword: string): Promise<void> {
  if (newPassword.length < 8) throw new Error("Password must be at least 8 characters.");
  const db = getDatabase();
  await db.migrate();
  const tokenHash = hashToken(token.trim());
  const resetToken = (await db.query<PasswordResetTokenRow>(
    `select id, user_id, token_hash, expires_at, used_at from password_reset_tokens where token_hash = ${db.placeholder(1)}`,
    [tokenHash],
  )).rows[0];
  if (!resetToken || resetToken.used_at) throw new Error("This password reset link is invalid or has already been used.");
  if (new Date(resetToken.expires_at).getTime() <= Date.now()) throw new Error("This password reset link has expired.");

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db.query(`update users set password_hash = ${db.placeholder(1)} where id = ${db.placeholder(2)}`, [passwordHash, resetToken.user_id]);
  await db.query(`update password_reset_tokens set used_at = ${db.placeholder(1)} where id = ${db.placeholder(2)}`, [new Date().toISOString(), resetToken.id]);
}

export async function updateUserName(userId: string, input: { name: string; currentPassword: string }): Promise<AppUser> {
  const name = normalizeName(input.name);
  assertAllowedName(name);
  const db = getDatabase();
  await db.migrate();
  const current = (await db.query<UserRow>(`select ${USER_COLUMNS} from users where id = ${db.placeholder(1)}`, [userId])).rows[0];
  if (!current) throw new Error("User not found.");
  if (!await bcrypt.compare(input.currentPassword, current.password_hash)) throw new Error("Current password is incorrect.");
  const existing = await findUserByName(name);
  if (existing && existing.id !== userId) throw new Error("An account with this name already exists.");
  await db.query(`update users set name = ${db.placeholder(1)} where id = ${db.placeholder(2)}`, [name, userId]);
  return toAppUser({ ...current, name }, await manualGroupsForUser(userId));
}

export async function deleteUserAccount(userId: string, input: { currentPassword: string }): Promise<void> {
  const db = getDatabase();
  await db.migrate();
  const current = (await db.query<UserRow>(`select ${USER_COLUMNS} from users where id = ${db.placeholder(1)}`, [userId])).rows[0];
  if (!current) throw new Error("User not found.");
  if (!await bcrypt.compare(input.currentPassword, current.password_hash)) throw new Error("Current password is incorrect.");
  await db.query(`delete from users where id = ${db.placeholder(1)}`, [userId]);
}

export async function deleteUserAccountAsAdmin(userId: string, confirmationName: string): Promise<void> {
  const db = getDatabase();
  await db.migrate();
  const current = (await db.query<UserRow>(`select ${USER_COLUMNS} from users where id = ${db.placeholder(1)}`, [userId])).rows[0];
  if (!current) throw new Error("User not found.");
  if (confirmationName !== current.name) throw new Error("Type the username to confirm account deletion.");
  await db.query(`delete from users where id = ${db.placeholder(1)}`, [userId]);
}

export async function listUsersForAdmin(): Promise<AdminUserListItem[]> {
  const db = getDatabase();
  await db.migrate();
  const users = (await db.query<UserRow>(`select ${USER_COLUMNS} from users order by lower(name), lower(email)`)).rows;
  const groupRows = (await db.query<GroupRow>("select user_id, name from user_groups order by name")).rows;
  return users.map((user) => toAppUser(user, groupRows.filter((group) => group.user_id === user.id).map((group) => group.name)));
}

export async function listUsersForDirectory(): Promise<DirectoryUserListItem[]> {
  const db = getDatabase();
  await db.migrate();
  const rows = (await db.query<DirectoryUserRow>(`
    select
      users.id,
      users.name as username,
      coalesce(sheet_totals.sail_miles, 0) as sail_miles,
      coalesce(sheet_totals.motor_miles, 0) as motor_miles,
      coalesce(sheet_totals.logbook_sheets, 0) as logbook_sheets,
      coalesce(boat_totals.boats, 0) as boats
    from users
    left join (
      select owner_id, sum(sail_miles) as sail_miles, sum(motor_miles) as motor_miles, count(*) as logbook_sheets
      from log_sheets
      group by owner_id
    ) sheet_totals on sheet_totals.owner_id = users.id
    left join (
      select owner_id, count(*) as boats
      from boats
      group by owner_id
    ) boat_totals on boat_totals.owner_id = users.id
    where not exists (select 1 from demo_sandboxes where demo_sandboxes.user_id = users.id)
    order by lower(users.name)
  `)).rows;
  return rows.map((row) => ({
    id: row.id,
    username: row.username,
    sailMiles: Number(row.sail_miles) || 0,
    motorMiles: Number(row.motor_miles) || 0,
    logbookSheets: Number(row.logbook_sheets) || 0,
    boats: Number(row.boats) || 0,
  }));
}

export async function listKnownGroups(): Promise<string[]> {
  const db = getDatabase();
  await db.migrate();
  const result = await db.query<GroupRow>("select distinct name from user_groups order by name");
  return result.rows.map((row) => row.name);
}

export async function updateUserGroups(userId: string, groups: string[]): Promise<AppUser> {
  const db = getDatabase();
  await db.migrate();
  const current = (await db.query<UserRow>(`select ${USER_COLUMNS} from users where id = ${db.placeholder(1)}`, [userId])).rows[0];
  if (!current) throw new Error("User not found.");
  const normalizedGroups = normalizeGroups(groups);
  normalizedGroups.forEach(assertAllowedGroupName);
  await db.query(`delete from user_groups where user_id = ${db.placeholder(1)}`, [userId]);
  for (const group of normalizedGroups) {
    await db.query(`insert into user_groups (user_id, name) values (${db.placeholder(1)}, ${db.placeholder(2)})`, [userId, group]);
  }
  return toAppUser(current, normalizedGroups);
}

export async function updateUserOnboardingCompletedTasks(userId: string, tasks: unknown): Promise<AppUser> {
  const db = getDatabase();
  await db.migrate();
  const current = (await db.query<UserRow>(`select ${USER_COLUMNS} from users where id = ${db.placeholder(1)}`, [userId])).rows[0];
  if (!current) throw new Error("User not found.");
  const onboardingCompletedTasks = normalizeOnboardingCompletedTasks(tasks);
  await db.query(`update users set onboarding_completed_tasks = ${db.placeholder(1)} where id = ${db.placeholder(2)}`, [serializeOnboardingCompletedTasks(onboardingCompletedTasks), userId]);
  return {
    ...toAppUser(current, await manualGroupsForUser(userId)),
    onboardingCompletedTasks,
  };
}

export async function updateUserViewPreferences(userId: string, input: Partial<Record<keyof UserPreferences, unknown>>): Promise<AppUser> {
  const db = getDatabase();
  await db.migrate();
  const current = (await db.query<UserRow>(`select ${USER_COLUMNS} from users where id = ${db.placeholder(1)}`, [userId])).rows[0];
  if (!current) throw new Error("User not found.");
  const preferences = normalizeUserPreferences(input, current, true);
  await db.query(
    `update users set country_code = ${db.placeholder(1)}, language = ${db.placeholder(2)}, wind_unit = ${db.placeholder(3)}, water_height_unit = ${db.placeholder(4)}, temperature_unit = ${db.placeholder(5)}, coordinate_format = ${db.placeholder(6)}, distance_display_unit = ${db.placeholder(7)}, default_boat_id = ${db.placeholder(8)}, default_crew_member_ids = ${db.placeholder(9)}, theme = ${db.placeholder(10)}, nav_slim = ${db.placeholder(11)}, show_course_conversion_table = ${db.placeholder(12)}, motion_stationary_threshold_nm = ${db.placeholder(13)} where id = ${db.placeholder(14)}`,
    [preferences.countryCode, preferences.language, preferences.windUnit, preferences.waterHeightUnit, preferences.temperatureUnit, preferences.coordinateFormat, preferences.distanceDisplayUnit, preferences.defaultBoatId, JSON.stringify(preferences.defaultCrewMemberIds), preferences.theme, preferences.isNavSlim ? 1 : 0, preferences.showCourseConversionTable ? 1 : 0, preferences.motionStationaryThresholdNm, userId],
  );
  return {
    ...toAppUser(current, await manualGroupsForUser(userId)),
    ...preferences,
  };
}

export async function updateUserComplianceRead(userId: string): Promise<AppUser> {
  const db = getDatabase();
  await db.migrate();
  const current = (await db.query<UserRow>(`select ${USER_COLUMNS} from users where id = ${db.placeholder(1)}`, [userId])).rows[0];
  if (!current) throw new Error("User not found.");
  await db.query(`update users set has_read_compliance = ${db.placeholder(1)} where id = ${db.placeholder(2)}`, [1, userId]);
  return {
    ...toAppUser(current, await manualGroupsForUser(userId)),
    hasReadCompliance: true,
  };
}

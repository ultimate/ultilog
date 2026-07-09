import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { isOnboardingTaskId, type OnboardingTaskId } from "./onboarding/tasks";
import { getDatabase, writeLogbook } from "./logbook-store";

export type UserTheme = "light" | "dark" | "auto";
export type UserPreferences = {
  countryCode: string;
  language: "en" | "de" | "fr" | "it";
  windUnit: "bft" | "kn" | "mps";
  waterHeightUnit: "m" | "ft";
  temperatureUnit: "c" | "f";
  coordinateFormat: "dd" | "dm" | "dms";
  distanceDisplayUnit: "nm" | "km" | "mi";
  defaultBoatId: string;
  defaultCrewMemberIds: string[];
  theme: UserTheme;
  isNavSlim: boolean;
  showCourseConversionTable: boolean;
};
export type AppUser = { id: string; name: string; email: string; groups: string[]; onboardingCompletedTasks: OnboardingTaskId[]; hasReadCompliance: boolean } & UserPreferences;
export type AdminUserListItem = AppUser;

type UserRow = Omit<AppUser, "groups" | "onboardingCompletedTasks" | "hasReadCompliance" | "isNavSlim" | "countryCode" | "windUnit" | "waterHeightUnit" | "temperatureUnit" | "coordinateFormat" | "distanceDisplayUnit" | "defaultBoatId" | "defaultCrewMemberIds" | "showCourseConversionTable"> & { password_hash: string; onboarding_completed_tasks: string; country_code: string; wind_unit: string; water_height_unit: string; temperature_unit: string; coordinate_format: string; distance_display_unit: string; default_boat_id: string; default_crew_member_ids: string; nav_slim: number | boolean; has_read_compliance: number | boolean; show_course_conversion_table: number | boolean };
type GroupRow = { user_id?: string; name: string };

const USER_COLUMNS = "id, name, email, password_hash, onboarding_completed_tasks, theme, nav_slim, has_read_compliance, country_code, language, wind_unit, water_height_unit, temperature_unit, coordinate_format, distance_display_unit, default_boat_id, default_crew_member_ids, show_course_conversion_table";

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const blockedNameTerms = ["admin", "ultilog", "support", "moderator", "fuck", "shit", "bitch", "asshole", "cunt", "nigger", "nazi"];

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, " ");
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
    windUnit: normalizeEnum(input.windUnit, ["bft", "kn", "mps"] as const, currentUser?.windUnit ?? "bft", "Wind unit", strict),
    waterHeightUnit: normalizeEnum(input.waterHeightUnit, ["m", "ft"] as const, currentUser?.waterHeightUnit ?? "m", "Water height unit", strict),
    temperatureUnit: normalizeEnum(input.temperatureUnit, ["c", "f"] as const, currentUser?.temperatureUnit ?? "c", "Temperature unit", strict),
    coordinateFormat: normalizeEnum(input.coordinateFormat, ["dd", "dm", "dms"] as const, currentUser?.coordinateFormat ?? "dm", "Coordinate format", strict),
    distanceDisplayUnit: normalizeEnum(input.distanceDisplayUnit, ["nm", "km", "mi"] as const, currentUser?.distanceDisplayUnit ?? "nm", "Distance display unit", strict),
    defaultBoatId: typeof input.defaultBoatId === "string" ? input.defaultBoatId.trim() : currentUser?.defaultBoatId ?? "",
    defaultCrewMemberIds: input.defaultCrewMemberIds === undefined ? currentUser?.defaultCrewMemberIds ?? [] : normalizeStringList(input.defaultCrewMemberIds),
    theme: normalizeEnum(input.theme, ["light", "dark", "auto"] as const, currentUser?.theme ?? "light", "Theme", strict),
    isNavSlim: input.isNavSlim === undefined ? currentUser?.isNavSlim ?? false : Boolean(input.isNavSlim),
    showCourseConversionTable: input.showCourseConversionTable === undefined ? currentUser?.showCourseConversionTable ?? true : Boolean(input.showCourseConversionTable),
  };
}

function toAppUser(user: UserRow, groups: string[]): AppUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    groups,
    onboardingCompletedTasks: parseOnboardingCompletedTasks(user.onboarding_completed_tasks),
    theme: normalizeTheme(user.theme),
    isNavSlim: normalizeBooleanFlag(user.nav_slim),
    hasReadCompliance: normalizeBooleanFlag(user.has_read_compliance),
    countryCode: user.country_code ?? "",
    language: normalizeEnum(user.language, ["en", "de", "fr", "it"] as const, "en", "Language"),
    windUnit: normalizeEnum(user.wind_unit, ["bft", "kn", "mps"] as const, "bft", "Wind unit"),
    waterHeightUnit: normalizeEnum(user.water_height_unit, ["m", "ft"] as const, "m", "Water height unit"),
    temperatureUnit: normalizeEnum(user.temperature_unit, ["c", "f"] as const, "c", "Temperature unit"),
    coordinateFormat: normalizeEnum(user.coordinate_format, ["dd", "dm", "dms"] as const, "dm", "Coordinate format"),
    distanceDisplayUnit: normalizeEnum(user.distance_display_unit, ["nm", "km", "mi"] as const, "nm", "Distance display unit"),
    defaultBoatId: user.default_boat_id ?? "",
    defaultCrewMemberIds: normalizeStringList(user.default_crew_member_ids),
    showCourseConversionTable: normalizeBooleanFlag(user.show_course_conversion_table ?? true),
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

async function groupsForUser(userId: string) {
  const db = getDatabase();
  await db.migrate();
  const result = await db.query<GroupRow>(`select name from user_groups where user_id = ${db.placeholder(1)} order by name`, [userId]);
  return result.rows.map((row) => row.name);
}

async function withGroups(user: UserRow | undefined): Promise<AppUser | undefined> {
  if (!user) return undefined;
  return toAppUser(user, await groupsForUser(user.id));
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
  return isValid ? toAppUser(user, await groupsForUser(user.id)) : null;
}

export async function validateDemoUser(): Promise<AppUser | null> {
  const user = await findUserByEmail("demo@ultilog.local");
  return user ?? null;
}

export function isAdminUser(user?: { groups?: string[] } | null) {
  return user?.groups?.includes("admin") ?? false;
}

export async function userHasGroup(userId: string, group: string) {
  return (await groupsForUser(userId)).includes(normalizeGroupName(group));
}

export async function registerUser(input: { name: string; email: string; password: string }): Promise<AppUser> {
  const name = normalizeName(input.name);
  const email = normalizeEmail(input.email);
  assertAllowedName(name);
  if (!email.includes("@")) throw new Error("Enter a valid email address.");
  if (input.password.length < 8) throw new Error("Password must be at least 8 characters.");
  if (await findUserByEmail(email)) throw new Error("An account with this email already exists.");
  if (await findUserByName(name)) throw new Error("An account with this name already exists.");

  const user: AppUser = { id: randomUUID(), name, email, groups: [], onboardingCompletedTasks: [], hasReadCompliance: false, ...normalizeUserPreferences({}) };
  const passwordHash = await bcrypt.hash(input.password, 10);
  const db = getDatabase();
  await db.query(
    `insert into users (id, name, email, password_hash) values (${db.placeholder(1)}, ${db.placeholder(2)}, ${db.placeholder(3)}, ${db.placeholder(4)})`,
    [user.id, user.name, user.email, passwordHash],
  );
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
  await db.query(`update users set email = ${db.placeholder(1)} where id = ${db.placeholder(2)}`, [email, userId]);
  return toAppUser({ ...current, email }, await groupsForUser(userId));
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
  return toAppUser({ ...current, name }, await groupsForUser(userId));
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
    ...toAppUser(current, await groupsForUser(userId)),
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
    `update users set country_code = ${db.placeholder(1)}, language = ${db.placeholder(2)}, wind_unit = ${db.placeholder(3)}, water_height_unit = ${db.placeholder(4)}, temperature_unit = ${db.placeholder(5)}, coordinate_format = ${db.placeholder(6)}, distance_display_unit = ${db.placeholder(7)}, default_boat_id = ${db.placeholder(8)}, default_crew_member_ids = ${db.placeholder(9)}, theme = ${db.placeholder(10)}, nav_slim = ${db.placeholder(11)}, show_course_conversion_table = ${db.placeholder(12)} where id = ${db.placeholder(13)}`,
    [preferences.countryCode, preferences.language, preferences.windUnit, preferences.waterHeightUnit, preferences.temperatureUnit, preferences.coordinateFormat, preferences.distanceDisplayUnit, preferences.defaultBoatId, JSON.stringify(preferences.defaultCrewMemberIds), preferences.theme, preferences.isNavSlim ? 1 : 0, preferences.showCourseConversionTable ? 1 : 0, userId],
  );
  return {
    ...toAppUser(current, await groupsForUser(userId)),
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
    ...toAppUser(current, await groupsForUser(userId)),
    hasReadCompliance: true,
  };
}

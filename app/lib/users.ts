import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { isOnboardingTaskId, type OnboardingTaskId } from "./onboarding/tasks";
import { getDatabase, writeLogbook } from "./logbook-store";

export type AppUser = { id: string; name: string; email: string; groups: string[]; onboardingCompletedTasks: OnboardingTaskId[] };
export type AdminUserListItem = AppUser;

type UserRow = Omit<AppUser, "groups" | "onboardingCompletedTasks"> & { password_hash: string; onboarding_completed_tasks: string };
type GroupRow = { user_id?: string; name: string };

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
  return { id: user.id, name: user.name, email: user.email, groups: await groupsForUser(user.id), onboardingCompletedTasks: parseOnboardingCompletedTasks(user.onboarding_completed_tasks) };
}

async function findUserByName(name: string) {
  const db = getDatabase();
  await db.migrate();
  const result = await db.query<UserRow>(`select id, name, email, password_hash, onboarding_completed_tasks from users where lower(name) = lower(${db.placeholder(1)})`, [normalizeName(name)]);
  return result.rows[0];
}

export async function findUserByEmail(email: string) {
  const db = getDatabase();
  await db.migrate();
  const result = await db.query<UserRow>(`select id, name, email, password_hash, onboarding_completed_tasks from users where email = ${db.placeholder(1)}`, [normalizeEmail(email)]);
  return withGroups(result.rows[0]);
}

export async function findUserById(userId: string) {
  const db = getDatabase();
  await db.migrate();
  const result = await db.query<UserRow>(`select id, name, email, password_hash, onboarding_completed_tasks from users where id = ${db.placeholder(1)}`, [userId]);
  return withGroups(result.rows[0]);
}

async function findUserRowByEmail(email: string) {
  const db = getDatabase();
  await db.migrate();
  const result = await db.query<UserRow>(`select id, name, email, password_hash, onboarding_completed_tasks from users where email = ${db.placeholder(1)}`, [normalizeEmail(email)]);
  return result.rows[0];
}

export async function validateUser(email: string, password: string): Promise<AppUser | null> {
  const user = await findUserRowByEmail(email);
  if (!user?.password_hash) return null;
  const isValid = await bcrypt.compare(password, user.password_hash);
  return isValid ? { id: user.id, name: user.name, email: user.email, groups: await groupsForUser(user.id), onboardingCompletedTasks: parseOnboardingCompletedTasks(user.onboarding_completed_tasks) } : null;
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

  const user: AppUser = { id: randomUUID(), name, email, groups: [], onboardingCompletedTasks: [] };
  const passwordHash = await bcrypt.hash(input.password, 10);
  const db = getDatabase();
  await db.query(
    `insert into users (id, name, email, password_hash) values (${db.placeholder(1)}, ${db.placeholder(2)}, ${db.placeholder(3)}, ${db.placeholder(4)})`,
    [user.id, user.name, user.email, passwordHash],
  );
  await writeLogbook({ boats: [], crewMembers: [{ id: "me", name: user.name, nationality: "", role: "Owner", address: "", certificate: "", isPrimary: true }], sheets: [] }, user.id);
  return user;
}

export async function updateUserEmail(userId: string, input: { email: string; currentPassword: string }): Promise<AppUser> {
  const email = normalizeEmail(input.email);
  if (!email.includes("@")) throw new Error("Enter a valid email address.");
  const db = getDatabase();
  await db.migrate();
  const current = (await db.query<UserRow>(`select id, name, email, password_hash, onboarding_completed_tasks from users where id = ${db.placeholder(1)}`, [userId])).rows[0];
  if (!current) throw new Error("User not found.");
  if (!await bcrypt.compare(input.currentPassword, current.password_hash)) throw new Error("Current password is incorrect.");
  const existing = await findUserByEmail(email);
  if (existing && existing.id !== userId) throw new Error("An account with this email already exists.");
  await db.query(`update users set email = ${db.placeholder(1)} where id = ${db.placeholder(2)}`, [email, userId]);
  return { id: current.id, name: current.name, email, groups: await groupsForUser(userId), onboardingCompletedTasks: parseOnboardingCompletedTasks(current.onboarding_completed_tasks) };
}

export async function updateUserPassword(userId: string, input: { currentPassword: string; newPassword: string }): Promise<void> {
  if (input.newPassword.length < 8) throw new Error("Password must be at least 8 characters.");
  const db = getDatabase();
  await db.migrate();
  const current = (await db.query<UserRow>(`select id, name, email, password_hash, onboarding_completed_tasks from users where id = ${db.placeholder(1)}`, [userId])).rows[0];
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
  const current = (await db.query<UserRow>(`select id, name, email, password_hash, onboarding_completed_tasks from users where id = ${db.placeholder(1)}`, [userId])).rows[0];
  if (!current) throw new Error("User not found.");
  if (!await bcrypt.compare(input.currentPassword, current.password_hash)) throw new Error("Current password is incorrect.");
  const existing = await findUserByName(name);
  if (existing && existing.id !== userId) throw new Error("An account with this name already exists.");
  await db.query(`update users set name = ${db.placeholder(1)} where id = ${db.placeholder(2)}`, [name, userId]);
  return { id: current.id, name, email: current.email, groups: await groupsForUser(userId), onboardingCompletedTasks: parseOnboardingCompletedTasks(current.onboarding_completed_tasks) };
}

export async function deleteUserAccount(userId: string, input: { currentPassword: string }): Promise<void> {
  const db = getDatabase();
  await db.migrate();
  const current = (await db.query<UserRow>(`select id, name, email, password_hash, onboarding_completed_tasks from users where id = ${db.placeholder(1)}`, [userId])).rows[0];
  if (!current) throw new Error("User not found.");
  if (!await bcrypt.compare(input.currentPassword, current.password_hash)) throw new Error("Current password is incorrect.");
  await db.query(`delete from users where id = ${db.placeholder(1)}`, [userId]);
}

export async function deleteUserAccountAsAdmin(userId: string, confirmationName: string): Promise<void> {
  const db = getDatabase();
  await db.migrate();
  const current = (await db.query<UserRow>(`select id, name, email, password_hash, onboarding_completed_tasks from users where id = ${db.placeholder(1)}`, [userId])).rows[0];
  if (!current) throw new Error("User not found.");
  if (confirmationName !== current.name) throw new Error("Type the username to confirm account deletion.");
  await db.query(`delete from users where id = ${db.placeholder(1)}`, [userId]);
}

export async function listUsersForAdmin(): Promise<AdminUserListItem[]> {
  const db = getDatabase();
  await db.migrate();
  const users = (await db.query<UserRow>("select id, name, email, password_hash, onboarding_completed_tasks from users order by lower(name), lower(email)")).rows;
  const groupRows = (await db.query<GroupRow>("select user_id, name from user_groups order by name")).rows;
  return users.map((user) => ({ id: user.id, name: user.name, email: user.email, groups: groupRows.filter((group) => group.user_id === user.id).map((group) => group.name), onboardingCompletedTasks: parseOnboardingCompletedTasks(user.onboarding_completed_tasks) }));
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
  const current = (await db.query<UserRow>(`select id, name, email, password_hash, onboarding_completed_tasks from users where id = ${db.placeholder(1)}`, [userId])).rows[0];
  if (!current) throw new Error("User not found.");
  const normalizedGroups = normalizeGroups(groups);
  normalizedGroups.forEach(assertAllowedGroupName);
  await db.query(`delete from user_groups where user_id = ${db.placeholder(1)}`, [userId]);
  for (const group of normalizedGroups) {
    await db.query(`insert into user_groups (user_id, name) values (${db.placeholder(1)}, ${db.placeholder(2)})`, [userId, group]);
  }
  return { id: current.id, name: current.name, email: current.email, groups: normalizedGroups, onboardingCompletedTasks: parseOnboardingCompletedTasks(current.onboarding_completed_tasks) };
}

export async function updateUserOnboardingCompletedTasks(userId: string, tasks: unknown): Promise<AppUser> {
  const db = getDatabase();
  await db.migrate();
  const current = (await db.query<UserRow>(`select id, name, email, password_hash, onboarding_completed_tasks from users where id = ${db.placeholder(1)}`, [userId])).rows[0];
  if (!current) throw new Error("User not found.");
  const onboardingCompletedTasks = normalizeOnboardingCompletedTasks(tasks);
  await db.query(`update users set onboarding_completed_tasks = ${db.placeholder(1)} where id = ${db.placeholder(2)}`, [serializeOnboardingCompletedTasks(onboardingCompletedTasks), userId]);
  return {
    id: current.id,
    name: current.name,
    email: current.email,
    groups: await groupsForUser(userId),
    onboardingCompletedTasks,
  };
}

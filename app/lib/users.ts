import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { getDatabase, writeLogbook } from "./logbook-store";

export type AppUser = { id: string; name: string; email: string };

type UserRow = AppUser & { password_hash: string };

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export async function findUserByEmail(email: string) {
  const db = getDatabase();
  await db.migrate();
  const result = await db.query<UserRow>(`select id, name, email, password_hash from users where email = ${db.placeholder(1)}`, [normalizeEmail(email)]);
  return result.rows[0];
}

export async function validateUser(email: string, password: string): Promise<AppUser | null> {
  const user = await findUserByEmail(email);
  if (!user?.password_hash) return null;
  const isValid = await bcrypt.compare(password, user.password_hash);
  return isValid ? { id: user.id, name: user.name, email: user.email } : null;
}

export async function registerUser(input: { name: string; email: string; password: string }): Promise<AppUser> {
  const name = input.name.trim();
  const email = normalizeEmail(input.email);
  if (name.length < 2) throw new Error("Name must be at least 2 characters.");
  if (!email.includes("@")) throw new Error("Enter a valid email address.");
  if (input.password.length < 8) throw new Error("Password must be at least 8 characters.");
  if (await findUserByEmail(email)) throw new Error("An account with this email already exists.");

  const user = { id: randomUUID(), name, email };
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
  const current = (await db.query<UserRow>(`select id, name, email, password_hash from users where id = ${db.placeholder(1)}`, [userId])).rows[0];
  if (!current) throw new Error("User not found.");
  if (!await bcrypt.compare(input.currentPassword, current.password_hash)) throw new Error("Current password is incorrect.");
  const existing = await findUserByEmail(email);
  if (existing && existing.id !== userId) throw new Error("An account with this email already exists.");
  await db.query(`update users set email = ${db.placeholder(1)} where id = ${db.placeholder(2)}`, [email, userId]);
  return { id: current.id, name: current.name, email };
}

export async function updateUserPassword(userId: string, input: { currentPassword: string; newPassword: string }): Promise<void> {
  if (input.newPassword.length < 8) throw new Error("Password must be at least 8 characters.");
  const db = getDatabase();
  await db.migrate();
  const current = (await db.query<UserRow>(`select id, name, email, password_hash from users where id = ${db.placeholder(1)}`, [userId])).rows[0];
  if (!current) throw new Error("User not found.");
  if (!await bcrypt.compare(input.currentPassword, current.password_hash)) throw new Error("Current password is incorrect.");
  const passwordHash = await bcrypt.hash(input.newPassword, 10);
  await db.query(`update users set password_hash = ${db.placeholder(1)} where id = ${db.placeholder(2)}`, [passwordHash, userId]);
}

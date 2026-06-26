import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { getDatabase } from "./logbook-store";

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
  return user;
}

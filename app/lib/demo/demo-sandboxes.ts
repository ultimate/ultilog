import { createHash, randomBytes, randomUUID } from "node:crypto";

import type { PersistedLogbook } from "../../models/logbook";
import { getDatabase, writeLogbook } from "../logbook-store";
import { findUserById, type AppUser } from "../users";
import { DEMO_LOGBOOK_TEMPLATE, DEMO_TEMPLATE_VERSION } from "./demo-template";

const DEFAULT_SANDBOX_TTL_HOURS = 6;
const LOGIN_TOKEN_TTL_MINUTES = 5;

type DemoTokenRow = { user_id: string; used_at?: string | null; sandbox_expires_at?: string };

export type DemoSandboxLogin = {
  token: string;
  expiresAt: string;
};

export class DemoCapacityError extends Error {}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function sandboxTtlHours() {
  const configured = Number(process.env.DEMO_SANDBOX_TTL_HOURS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_SANDBOX_TTL_HOURS;
}

function writableDemoTemplate(): PersistedLogbook {
  return structuredClone(DEMO_LOGBOOK_TEMPLATE) as PersistedLogbook;
}

export async function createDemoSandbox(options: { ipHash?: string; deviceHash?: string } = {}): Promise<DemoSandboxLogin> {
  const db = getDatabase();
  await db.migrate();

  const suffix = randomUUID();
  const userId = `demo-${suffix}`;
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + sandboxTtlHours() * 60 * 60 * 1000).toISOString();
  const tokenExpiresAt = new Date(now.getTime() + LOGIN_TOKEN_TTL_MINUTES * 60 * 1000).toISOString();

  const active = async (column?: "requester_ip_hash" | "requester_device_hash", value?: string) => Number((await db.query<{ count: number | string }>(
    `select count(*) as count from demo_sandboxes where expires_at > ${db.placeholder(1)}${column ? ` and ${column} = ${db.placeholder(2)}` : ""}`,
    column ? [now.toISOString(), value] : [now.toISOString()],
  )).rows[0]?.count) || 0;
  if (await active() >= 100 || (options.ipHash && await active("requester_ip_hash", options.ipHash) >= 3) || (options.deviceHash && await active("requester_device_hash", options.deviceHash) >= 2)) {
    throw new DemoCapacityError("Demo sandbox capacity reached.");
  }

  try {
    await db.query(
      `insert into users (id, name, email, password_hash, email_verified_at) values (${db.placeholder(1)}, ${db.placeholder(2)}, ${db.placeholder(3)}, ${db.placeholder(4)}, ${db.placeholder(5)})`,
      [userId, `Demo ${suffix.slice(0, 8)}`, `demo+${suffix}@ultilog.local`, "", now.toISOString()],
    );
    await db.query(`insert into user_groups (user_id, name) values (${db.placeholder(1)}, ${db.placeholder(2)})`, [userId, "demo"]);
    await db.query(
      `insert into demo_sandboxes (user_id, template_version, expires_at, last_accessed_at, requester_ip_hash, requester_device_hash) values (${db.placeholder(1)}, ${db.placeholder(2)}, ${db.placeholder(3)}, ${db.placeholder(4)}, ${db.placeholder(5)}, ${db.placeholder(6)})`,
      [userId, DEMO_TEMPLATE_VERSION, expiresAt, now.toISOString(), options.ipHash ?? "", options.deviceHash ?? ""],
    );
    await db.query(
      `insert into demo_login_tokens (token_hash, user_id, expires_at) values (${db.placeholder(1)}, ${db.placeholder(2)}, ${db.placeholder(3)})`,
      [tokenHash(token), userId, tokenExpiresAt],
    );
    await writeLogbook(writableDemoTemplate(), userId);
  } catch (error) {
    await db.query(`delete from users where id = ${db.placeholder(1)}`, [userId]).catch(() => undefined);
    throw error;
  }

  return { token, expiresAt };
}

export async function consumeDemoSandboxLogin(token: string): Promise<AppUser | null> {
  const normalizedToken = token.trim();
  if (!normalizedToken) return null;

  const db = getDatabase();
  await db.migrate();
  const now = new Date().toISOString();
  const claim = `${now}#${randomUUID()}`;
  const hash = tokenHash(normalizedToken);
  const row = (await db.query<DemoTokenRow>(`
    select demo_login_tokens.user_id, demo_sandboxes.expires_at as sandbox_expires_at
    from demo_login_tokens
    join demo_sandboxes on demo_sandboxes.user_id = demo_login_tokens.user_id
    where demo_login_tokens.token_hash = ${db.placeholder(1)}
      and demo_login_tokens.used_at is null
      and demo_login_tokens.expires_at > ${db.placeholder(2)}
      and demo_sandboxes.expires_at > ${db.placeholder(3)}
  `, [hash, now, now])).rows[0];
  if (!row) return null;

  await db.query(
    `update demo_login_tokens set used_at = ${db.placeholder(1)} where token_hash = ${db.placeholder(2)} and used_at is null`,
    [claim, hash],
  );
  const claimed = (await db.query<DemoTokenRow>(
    `select user_id, used_at from demo_login_tokens where token_hash = ${db.placeholder(1)}`,
    [hash],
  )).rows[0];
  if (claimed?.used_at !== claim || claimed.user_id !== row.user_id) return null;

  await db.query(`update demo_sandboxes set last_accessed_at = ${db.placeholder(1)} where user_id = ${db.placeholder(2)}`, [now, row.user_id]);
  const user = await findUserById(row.user_id);
  return user ? { ...user, demoSandboxExpiresAt: row.sandbox_expires_at } : null;
}

export async function resetDemoSandbox(userId: string): Promise<PersistedLogbook | null> {
  const db = getDatabase();
  await db.migrate();
  const now = new Date().toISOString();
  const sandbox = (await db.query<{ user_id: string }>(
    `select user_id from demo_sandboxes where user_id = ${db.placeholder(1)} and expires_at > ${db.placeholder(2)}`,
    [userId, now],
  )).rows[0];
  if (!sandbox) return null;

  const logbook = writableDemoTemplate();
  const resetLogbook = await writeLogbook(logbook, userId);
  await db.query(`update demo_sandboxes set last_accessed_at = ${db.placeholder(1)}, template_version = ${db.placeholder(2)} where user_id = ${db.placeholder(3)}`, [now, DEMO_TEMPLATE_VERSION, userId]);
  return resetLogbook;
}

export type DemoSandboxCleanupResult = {
  sandboxesDeleted: number;
  loginTokensDeleted: number;
};

export async function cleanupExpiredDemoSandboxes(options: { now?: Date; limit?: number } = {}): Promise<DemoSandboxCleanupResult> {
  const db = getDatabase();
  await db.migrate();
  const now = (options.now ?? new Date()).toISOString();
  const limit = Math.max(1, Math.min(1000, Math.floor(options.limit ?? 100)));
  const expiredSandboxes = (await db.query<{ user_id: string }>(
    `select user_id from demo_sandboxes where expires_at <= ${db.placeholder(1)} order by expires_at limit ${db.placeholder(2)}`,
    [now, limit],
  )).rows;
  const expiredTokenCount = Number((await db.query<{ count: number | string }>(
    `select count(*) as count from demo_login_tokens where expires_at <= ${db.placeholder(1)}`,
    [now],
  )).rows[0]?.count) || 0;

  await db.query(`delete from demo_login_tokens where expires_at <= ${db.placeholder(1)}`, [now]);
  for (const sandbox of expiredSandboxes) {
    await deleteDemoSandboxUser(db, sandbox.user_id);
  }
  await db.flush();
  return { sandboxesDeleted: expiredSandboxes.length, loginTokensDeleted: expiredTokenCount };
}

async function deleteDemoSandboxUser(db: ReturnType<typeof getDatabase>, userId: string) {
  const owner = db.placeholder(1);
  await db.query(`delete from log_lines where sheet_id in (select id from log_sheets where owner_id = ${owner})`, [userId]);
  await db.query(`delete from sheet_crew_members where sheet_id in (select id from log_sheets where owner_id = ${owner})`, [userId]);
  await db.query(`delete from crew_members where owner_id = ${owner}`, [userId]);
  await db.query(`delete from log_sheets where owner_id = ${owner}`, [userId]);
  await db.query(`delete from boats where owner_id = ${owner}`, [userId]);
  await db.query(`delete from password_reset_tokens where user_id = ${owner}`, [userId]);
  await db.query(`delete from email_verification_tokens where user_id = ${owner}`, [userId]);
  await db.query(`delete from demo_login_tokens where user_id = ${owner}`, [userId]);
  await db.query(`delete from user_groups where user_id = ${owner}`, [userId]);
  await db.query(`delete from demo_sandboxes where user_id = ${owner}`, [userId]);
  await db.query(`delete from users where id = ${owner}`, [userId]);
}

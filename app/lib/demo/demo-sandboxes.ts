import { createHash, randomBytes, randomUUID } from "node:crypto";

import type { PersistedLogbook } from "../../models/logbook";
import { getDatabase, writeLogbook } from "../logbook-store";
import { findUserById, type AppUser } from "../users";
import { DEMO_LOGBOOK_TEMPLATE, DEMO_TEMPLATE_VERSION } from "./demo-template";

const DEFAULT_SANDBOX_TTL_HOURS = 6;
const LOGIN_TOKEN_TTL_MINUTES = 5;

type DemoTokenRow = { user_id: string; used_at?: string | null };

export type DemoSandboxLogin = {
  token: string;
  expiresAt: string;
};

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

export async function createDemoSandbox(): Promise<DemoSandboxLogin> {
  const db = getDatabase();
  await db.migrate();

  const suffix = randomUUID();
  const userId = `demo-${suffix}`;
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + sandboxTtlHours() * 60 * 60 * 1000).toISOString();
  const tokenExpiresAt = new Date(now.getTime() + LOGIN_TOKEN_TTL_MINUTES * 60 * 1000).toISOString();

  try {
    await db.query(
      `insert into users (id, name, email, password_hash, email_verified_at) values (${db.placeholder(1)}, ${db.placeholder(2)}, ${db.placeholder(3)}, ${db.placeholder(4)}, ${db.placeholder(5)})`,
      [userId, `Demo ${suffix.slice(0, 8)}`, `demo+${suffix}@ultilog.local`, "", now.toISOString()],
    );
    await db.query(`insert into user_groups (user_id, name) values (${db.placeholder(1)}, ${db.placeholder(2)})`, [userId, "demo"]);
    await db.query(
      `insert into demo_sandboxes (user_id, template_version, expires_at, last_accessed_at) values (${db.placeholder(1)}, ${db.placeholder(2)}, ${db.placeholder(3)}, ${db.placeholder(4)})`,
      [userId, DEMO_TEMPLATE_VERSION, expiresAt, now.toISOString()],
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
    select demo_login_tokens.user_id
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
  return (await findUserById(row.user_id)) ?? null;
}

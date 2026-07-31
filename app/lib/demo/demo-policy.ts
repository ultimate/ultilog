import { getDatabase } from "../logbook-store";

export async function isActiveDemoSandbox(userId: string) {
  const db = getDatabase();
  await db.migrate();
  const row = (await db.query<{ user_id: string }>(
    `select user_id from demo_sandboxes where user_id = ${db.placeholder(1)} and expires_at > ${db.placeholder(2)}`,
    [userId, new Date().toISOString()],
  )).rows[0];
  return Boolean(row);
}

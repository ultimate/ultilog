import type { QueryableDatabase } from "./db/logbook-database";

/** Demo accounts never qualify for sharing restricted to registered users. */
export async function canAccessRegisteredShares(database: QueryableDatabase, userId?: string) {
  if (!userId) return false;
  const result = await database.query<{ id: string }>(
    `select id from users where id = ${database.placeholder(1)}
      and not exists (select 1 from user_groups where user_id = users.id and name = 'demo')
      and not exists (select 1 from demo_sandboxes where user_id = users.id)`,
    [userId],
  );
  return result.rows.length > 0;
}

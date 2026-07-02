import type { QueryableDatabase } from "./logbook-database";
import { readMigrations } from "./schema";

export async function runMigrations(db: QueryableDatabase) {
  await db.query(`
    create table if not exists schema_migrations (
      id text primary key,
      applied_at text not null default current_timestamp
    )
  `);

  const appliedRows = await db.query<{ id: string }>("select id from schema_migrations order by id");
  const applied = new Set(appliedRows.rows.map((row) => row.id));

  for (const migration of await readMigrations()) {
    if (applied.has(migration.id)) continue;
    await applyMigration(db, migration.id, migration.sql);
    await db.query(`insert into schema_migrations (id) values (${db.placeholder(1)})`, [migration.id]);
  }
}

async function applyMigration(db: QueryableDatabase, id: string, sql: string) {
  if (id !== "009_log_line_column_types") {
    await db.query(sql);
    return;
  }

  for (const statement of sql.split(";").map((part) => part.trim()).filter(Boolean)) {
    try {
      await db.query(statement);
    } catch (error) {
      if (!isDuplicateColumnError(error)) throw error;
    }
  }
}

function isDuplicateColumnError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /duplicate column|already exists|column .* exists/i.test(message);
}

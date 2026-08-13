import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { describe } from "vitest";
import { PostgresLogbookDatabase } from "../../../../app/lib/db/postgres-logbook-database";
import { SqliteLogbookDatabase } from "../../../../app/lib/db/sqlite-logbook-database";
import { logbookDatabaseContract } from "./logbook-database-contract";

logbookDatabaseContract("SQLite", {
  async create() {
    const directory = await mkdtemp(join(tmpdir(), "ultilog-contract-"));
    return { database: new SqliteLogbookDatabase(join(directory, "test.sqlite")), cleanup: () => rm(directory, { recursive: true, force: true }) };
  },
  async installMetricFailure(database) {
    await database.query("create trigger contract_metric_failure before update of motor_miles on log_sheets begin select raise(abort, 'metric update failed'); end");
  },
});

const postgresUrl = process.env.TEST_POSTGRES_URL;
describe.runIf(Boolean(postgresUrl))("PostgreSQL integration", () => {
  logbookDatabaseContract("PostgreSQL", {
    async create() {
      const schema = `contract_${randomUUID().replaceAll("-", "")}`;
      const administrator = new Pool({ connectionString: postgresUrl });
      await administrator.query(`create schema ${schema}`);
      const url = new URL(postgresUrl!);
      url.searchParams.set("options", `-c search_path=${schema}`);
      const database = new PostgresLogbookDatabase(url.toString());
      return {
        database,
        cleanup: async () => {
          await database.close();
          await administrator.query(`drop schema if exists ${schema} cascade`);
          await administrator.end();
        },
      };
    },
    async installMetricFailure(database) {
      await database.query("create function contract_fail_metrics() returns trigger language plpgsql as $$ begin raise exception 'metric update failed'; end $$");
      await database.query("create trigger contract_metric_failure before update of motor_miles on log_sheets for each row execute function contract_fail_metrics()");
    },
  });
});

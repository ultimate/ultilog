import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { PostgresLogbookDatabase } from "../../../../app/lib/db/postgres-logbook-database";
import { SqliteLogbookDatabase } from "../../../../app/lib/db/sqlite-logbook-database";
import { logbookDatabaseContract } from "./logbook-database-contract";
import { NORMALIZED_BOAT_MASTER_DATA_MIGRATION_ID } from "../../../../app/lib/db/schema";

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

  it("atomically upgrades a real pre-047 database and remains usable", async () => {
    const schema = `migration_${randomUUID().replaceAll("-", "")}`;
    const administrator = new Pool({ connectionString: postgresUrl });
    await administrator.query(`create schema ${schema}`);
    const url = new URL(postgresUrl!);
    url.searchParams.set("options", `-c search_path=${schema}`);
    const database = new PostgresLogbookDatabase(url.toString());
    try {
      await database.migrate();
      await database.query("alter table boats add column yacht_data text");
      await database.query("delete from schema_migrations where id = $1", [NORMALIZED_BOAT_MASTER_DATA_MIGRATION_ID]);
      await database.query("insert into users (id, name, email, password_hash) values ($1, $2, $3, $4)", ["owner", "Owner", "owner@example.test", ""]);
      await database.query("insert into boats (id, name, type, registration, flag_state, home_port, owner, dimensions, owner_id, yacht_data, manufacturer, mmsi) values ($1, $2, 'Sail', '', '', '', '', '', 'owner', $3, null, null), ($4, $5, 'Sail', '', '', '', '', '', 'owner', $6, $7, $8)", ["owner:legacy", "Legacy", JSON.stringify({ Manufacturer: " Legacy yard ", MMSI: " 269123456 ", Engine: " D2-55 ", Electronics: "VHF" }), "owner:existing", "Existing", JSON.stringify({ Manufacturer: "Old yard", MMSI: "999", Engine: "Old engine" }), "Current yard", "123"]);
      await database.query("insert into engines (id, boat_id, sort_order, name, short_label, role, model) values ($1, $2, 0, 'Main engine', 'Main', 'propulsion', ''), ($3, $4, 0, 'Main engine', 'Main', 'propulsion', 'Current engine')", ["owner:legacy:main", "owner:legacy", "owner:existing:main", "owner:existing"]);
      await database.query("create function fail_047_marker() returns trigger language plpgsql as $$ begin if new.id = '047_normalize_boat_master_data' then raise exception 'injected migration failure'; end if; return new; end $$");
      await database.query("create trigger fail_047_marker before insert on schema_migrations for each row execute function fail_047_marker() ");

      await expect(database.migrate()).rejects.toThrow("injected migration failure");
      expect((await database.query("select yacht_data from boats")).rows).toHaveLength(2);
      expect((await database.query("select manufacturer, mmsi from boats where id = $1", ["owner:existing"])).rows).toEqual([{ manufacturer: "Current yard", mmsi: "123" }]);

      await database.query("drop trigger fail_047_marker on schema_migrations");
      await database.migrate();
      const migrated = await database.forUser("owner").readLogbook();
      expect(migrated.boats.find(({ id }) => id === "legacy")).toMatchObject({ manufacturer: "Legacy yard", mmsi: "269123456", engines: [expect.objectContaining({ model: "D2-55" })] });
      expect(migrated.boats.find(({ id }) => id === "existing")).toMatchObject({ manufacturer: "Current yard", mmsi: "123", engines: [expect.objectContaining({ model: "Current engine" })] });
      await expect(database.query("select yacht_data from boats")).rejects.toThrow(/column .* does not exist/i);
      const legacy = migrated.boats.find(({ id }) => id === "legacy")!;
      expect((await database.upsertBoat({ ...legacy, manufacturer: "Updated yard" }))?.manufacturer).toBe("Updated yard");
    } finally {
      await database.close();
      await administrator.query(`drop schema if exists ${schema} cascade`);
      await administrator.end();
    }
  });
});

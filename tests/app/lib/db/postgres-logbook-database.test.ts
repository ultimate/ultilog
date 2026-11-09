import { Client } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PostgresLogbookDatabase } from "../../../../app/lib/db/postgres-logbook-database";

const { poolConstructor } = vi.hoisted(() => ({ poolConstructor: vi.fn() }));

vi.mock("pg", async (importOriginal) => ({
  ...await importOriginal<typeof import("pg")>(),
  Pool: vi.fn(function Pool(options: unknown) { poolConstructor(options); }),
}));

describe("PostgreSQL SSL configuration", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it.each(["prefer", "require", "verify-ca"])("preserves full verification for sslmode=%s without a warning", (mode) => {
    const original = new URL(`postgresql://user:p%40ss@db.example:5432/logbook?sslmode=${mode}&channel_binding=require&options=-c%20search_path%3Dlogbook`);
    new PostgresLogbookDatabase(original.toString());
    const config = poolConstructor.mock.calls[0][0];
    const normalized = new URL(config.connectionString);
    expect(normalized.searchParams.get("sslmode")).toBe("verify-full");
    normalized.searchParams.set("sslmode", mode);
    expect(normalized.protocol).toBe(original.protocol);
    expect(normalized.host).toBe(original.host);
    expect(normalized.username).toBe(original.username);
    expect(normalized.password).toBe(original.password);
    expect(normalized.pathname).toBe(original.pathname);
    expect([...normalized.searchParams]).toEqual([...original.searchParams]);

    const warning = vi.spyOn(process, "emitWarning");
    try {
      // Exercise the real driver parser without opening a network connection.
      const client = new Client(config);
      expect(client.ssl).toBeTruthy();
      expect(client.ssl).not.toHaveProperty("rejectUnauthorized", false);
      expect(client.ssl).not.toHaveProperty("checkServerIdentity");
      expect(warning).not.toHaveBeenCalled();
    } finally {
      warning.mockRestore();
    }
  });

  it.each([undefined, "verify-full", "disable", "no-verify"])("leaves sslmode=%s unchanged", (mode) => {
    const url = `postgres://user:password@localhost:5432/logbook?application_name=ulti%20log${mode ? `&sslmode=${mode}` : ""}`;
    new PostgresLogbookDatabase(url);
    expect(poolConstructor).toHaveBeenCalledWith({ connectionString: url });
  });
});

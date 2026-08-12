import { beforeEach, describe, expect, it, vi } from "vitest";

const sqliteConstructor = vi.fn();
const postgresConstructor = vi.fn();
const sqliteReadLogbook = vi.fn();
const sqliteWriteLogbook = vi.fn();
const postgresReadLogbook = vi.fn();
const postgresWriteLogbook = vi.fn();
const sqliteReadSharedSheet = vi.fn();

function databaseStub(readLogbook = sqliteReadLogbook, writeLogbook = sqliteWriteLogbook) {
  return {
    forUser: vi.fn(() => ({ readLogbook, writeLogbook })),
    readSharedSheet: sqliteReadSharedSheet,
  };
}

vi.mock("../../../app/lib/db/sqlite-logbook-database", () => ({
  SqliteLogbookDatabase: vi.fn(function SqliteLogbookDatabase(path: string) {
    sqliteConstructor(path);
    return databaseStub();
  }),
}));

vi.mock("../../../app/lib/db/postgres-logbook-database", () => ({
  PostgresLogbookDatabase: vi.fn(function PostgresLogbookDatabase(url: string) {
    postgresConstructor(url);
    return databaseStub(postgresReadLogbook, postgresWriteLogbook);
  }),
}));

describe("logbook store", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete (globalThis as typeof globalThis & { __ultilogLogbookStores?: unknown }).__ultilogLogbookStores;
    delete process.env.POSTGRES_URL;
    delete process.env.DATABASE_URL;
    delete process.env.LOCAL_DATABASE_PATH;
  });

  it("shares the write queue across module instances", async () => {
    process.env.LOCAL_DATABASE_PATH = "/tmp/ultilog-shared-queue.sqlite";
    let finishWrite: (() => void) | undefined;
    const logbook = { boats: [], crewMembers: [], sheets: [] };
    sqliteWriteLogbook.mockReturnValueOnce(new Promise<void>((resolve) => { finishWrite = resolve; }));
    sqliteReadLogbook.mockResolvedValueOnce(logbook);
    const firstStore = await import("../../../app/lib/logbook-store");
    const write = firstStore.writeLogbook(logbook, "user-1");

    vi.resetModules();
    const secondStore = await import("../../../app/lib/logbook-store");
    const read = secondStore.readLogbook("user-1");
    await Promise.resolve();

    expect(sqliteReadLogbook).not.toHaveBeenCalled();
    finishWrite?.();
    await write;
    await expect(read).resolves.toBe(logbook);
    expect(sqliteConstructor).toHaveBeenCalledOnce();
  });

  it("uses the configured local database path by default", async () => {
    process.env.LOCAL_DATABASE_PATH = "/tmp/ultilog-test.sqlite";
    sqliteReadLogbook.mockResolvedValueOnce({ boats: [], crewMembers: [], sheets: [] });
    const { readLogbook } = await import("../../../app/lib/logbook-store");

    await readLogbook("user-1");

    expect(sqliteConstructor).toHaveBeenCalledWith("/tmp/ultilog-test.sqlite");
  });

  it("prefers POSTGRES_URL for database selection", async () => {
    process.env.POSTGRES_URL = "postgres://example/postgres-url";
    postgresReadLogbook.mockResolvedValueOnce({ boats: [], crewMembers: [], sheets: [] });
    const { readLogbook } = await import("../../../app/lib/logbook-store");

    await readLogbook("user-1");

    expect(postgresConstructor).toHaveBeenCalledWith("postgres://example/postgres-url");
    expect(sqliteConstructor).not.toHaveBeenCalled();
  });

  it("falls back to DATABASE_URL for postgres connections", async () => {
    process.env.DATABASE_URL = "postgres://example/database-url";
    postgresReadLogbook.mockResolvedValueOnce({ boats: [], crewMembers: [], sheets: [] });
    const { readLogbook } = await import("../../../app/lib/logbook-store");

    await readLogbook("user-1");

    expect(postgresConstructor).toHaveBeenCalledWith("postgres://example/database-url");
  });

  it("serializes reads behind pending writes", async () => {
    let finishWrite: (() => void) | undefined;
    const logbook = { boats: [], crewMembers: [], sheets: [] };
    sqliteWriteLogbook.mockReturnValueOnce(new Promise<void>((resolve) => {
      finishWrite = resolve;
    }));
    sqliteReadLogbook.mockResolvedValueOnce(logbook);
    const { readLogbook, writeLogbook } = await import("../../../app/lib/logbook-store");

    const write = writeLogbook(logbook, "user-1");
    const read = readLogbook("user-1");
    await Promise.resolve();

    expect(sqliteReadLogbook).not.toHaveBeenCalled();
    finishWrite?.();
    await write;
    await expect(read).resolves.toBe(logbook);
    expect(sqliteReadLogbook).toHaveBeenCalledOnce();
  });

  it("continues processing queued operations after a write failure", async () => {
    const logbook = { boats: [], crewMembers: [], sheets: [] };
    sqliteWriteLogbook.mockRejectedValueOnce(new Error("write failed"));
    sqliteReadSharedSheet.mockResolvedValueOnce({ sheet: { id: "sheet-1" }, boatName: "Aurora" });
    const { readSharedLogSheet, writeLogbook } = await import("../../../app/lib/logbook-store");

    await expect(writeLogbook(logbook, "user-1")).rejects.toThrow("write failed");
    await expect(readSharedLogSheet("sheet-1", true, "owner-1")).resolves.toEqual({ sheet: { id: "sheet-1" }, boatName: "Aurora" });
    expect(sqliteReadSharedSheet).toHaveBeenCalledWith("sheet-1", true, "owner-1");
  });
});

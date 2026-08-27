import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let directory = "";

beforeEach(async () => {
  vi.resetModules();
  directory = await mkdtemp(join(tmpdir(), "ultilog-demo-sandbox-"));
  process.env.LOCAL_DATABASE_PATH = join(directory, "ultilog.sqlite");
});

afterEach(async () => {
  delete process.env.LOCAL_DATABASE_PATH;
  delete process.env.DEMO_SANDBOX_TTL_HOURS;
  await rm(directory, { force: true, recursive: true });
});

describe("demo sandboxes", () => {
  it("creates isolated users with independent copies of the template", async () => {
    const { createDemoSandbox, consumeDemoSandboxLogin } = await import("../../../../app/lib/demo/demo-sandboxes");
    const { readLogbook, writeLogbook } = await import("../../../../app/lib/logbook-store");

    const firstLogin = await createDemoSandbox();
    const secondLogin = await createDemoSandbox();
    const firstUser = await consumeDemoSandboxLogin(firstLogin.token);
    const secondUser = await consumeDemoSandboxLogin(secondLogin.token);

    expect(firstUser).toMatchObject({ groups: ["demo"] });
    expect(secondUser).toMatchObject({ groups: ["demo"] });
    expect(firstUser?.demoSandboxExpiresAt).toBe(firstLogin.expiresAt);
    expect(firstUser?.id).not.toBe(secondUser?.id);

    const firstLogbook = await readLogbook(firstUser!.id);
    const secondLogbook = await readLogbook(secondUser!.id);
    expect(withoutConcurrencyMetadata(firstLogbook)).toEqual(withoutConcurrencyMetadata(secondLogbook));
    await writeLogbook({ ...firstLogbook, sheets: firstLogbook.sheets.slice(1) }, firstUser!.id);

    await expect(readLogbook(firstUser!.id)).resolves.toMatchObject({ sheets: { length: 7 } });
    await expect(readLogbook(secondUser!.id)).resolves.toMatchObject({ sheets: { length: 8 } });
  });

  it("only accepts each short-lived login token once", async () => {
    const { createDemoSandbox, consumeDemoSandboxLogin } = await import("../../../../app/lib/demo/demo-sandboxes");
    const login = await createDemoSandbox();

    await expect(consumeDemoSandboxLogin(login.token)).resolves.toMatchObject({ groups: ["demo"] });
    await expect(consumeDemoSandboxLogin(login.token)).resolves.toBeNull();
    await expect(consumeDemoSandboxLogin("unknown-token")).resolves.toBeNull();
  });

  it("allows only one concurrent claimant for a login token", async () => {
    const { createDemoSandbox, consumeDemoSandboxLogin } = await import("../../../../app/lib/demo/demo-sandboxes");
    const login = await createDemoSandbox();

    const claimants = await Promise.all([consumeDemoSandboxLogin(login.token), consumeDemoSandboxLogin(login.token)]);

    expect(claimants.filter(Boolean)).toHaveLength(1);
  });

  it("records the configured sandbox expiry and template version", async () => {
    process.env.DEMO_SANDBOX_TTL_HOURS = "2";
    const before = Date.now();
    const { createDemoSandbox } = await import("../../../../app/lib/demo/demo-sandboxes");
    const { getDatabase } = await import("../../../../app/lib/logbook-store");
    const login = await createDemoSandbox();
    const rows = (await getDatabase().query<{ template_version: number; expires_at: string }>("select template_version, expires_at from demo_sandboxes")).rows;

    expect(rows).toHaveLength(1);
    expect(rows[0].template_version).toBe(4);
    expect(new Date(rows[0].expires_at).getTime()).toBeGreaterThanOrEqual(before + (2 * 60 * 60 * 1000));
    expect(login.expiresAt).toBe(rows[0].expires_at);
  });

  it("migrates an active sandbox from an older demo template when its login is consumed", async () => {
    const { createDemoSandbox, consumeDemoSandboxLogin } = await import("../../../../app/lib/demo/demo-sandboxes");
    const { getDatabase, readLogbook } = await import("../../../../app/lib/logbook-store");
    const login = await createDemoSandbox();
    const db = getDatabase();
    const sandbox = (await db.query<{ user_id: string }>("select user_id from demo_sandboxes")).rows[0];
    await db.query("update demo_sandboxes set template_version = ? where user_id = ?", [3, sandbox.user_id]);
    await db.query("delete from log_sheets where owner_id = ?", [sandbox.user_id]);

    const user = await consumeDemoSandboxLogin(login.token);

    expect(user?.id).toBe(sandbox.user_id);
    const migrated = await readLogbook(sandbox.user_id);
    expect(migrated.sheets).toHaveLength(8);
    expect(migrated.sheets.every((sheet) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/i.test(sheet.id))).toBe(true);
    await expect(db.query<{ template_version: number }>("select template_version from demo_sandboxes where user_id = ?", [sandbox.user_id])).resolves.toMatchObject({ rows: [{ template_version: 4 }] });
  });

  it("resets only an active demo sandbox to a fresh template copy", async () => {
    const { createDemoSandbox, consumeDemoSandboxLogin, resetDemoSandbox } = await import("../../../../app/lib/demo/demo-sandboxes");
    const { getDatabase, readLogbook, writeLogbook } = await import("../../../../app/lib/logbook-store");
    const login = await createDemoSandbox();
    const user = await consumeDemoSandboxLogin(login.token);
    const original = await readLogbook(user!.id);
    await writeLogbook({ ...original, boats: [], sheets: [] }, user!.id);
    const querySpy = vi.spyOn(getDatabase(), "query");

    const reset = await resetDemoSandbox(user!.id);

    expect(reset).toMatchObject({ boats: { length: 2 }, crewMembers: { length: 5 }, sheets: { length: 8 } });
    expect(querySpy.mock.calls.some(([sql]) => sql.includes("select * from boats"))).toBe(false);
    const storedReset = await readLogbook(user!.id);
    expect(storedReset).toMatchObject({ boats: { length: 2 }, crewMembers: { length: 5 }, sheets: { length: 8 } });
    expect(new Set(storedReset.boats.map((boat) => boat.id))).toEqual(new Set(reset!.boats.map((boat) => boat.id)));
    expect(new Set(storedReset.sheets.map((sheet) => sheet.id))).toEqual(new Set(reset!.sheets.map((sheet) => sheet.id)));
    await expect(resetDemoSandbox("not-a-demo-sandbox")).resolves.toBeNull();
  });

  it("refuses to reset an expired sandbox", async () => {
    const { createDemoSandbox, consumeDemoSandboxLogin, resetDemoSandbox } = await import("../../../../app/lib/demo/demo-sandboxes");
    const { getDatabase } = await import("../../../../app/lib/logbook-store");
    const login = await createDemoSandbox();
    const user = await consumeDemoSandboxLogin(login.token);
    await getDatabase().query("update demo_sandboxes set expires_at = ? where user_id = ?", ["2000-01-01T00:00:00.000Z", user!.id]);

    await expect(resetDemoSandbox(user!.id)).resolves.toBeNull();
  });

  it("deletes expired sandboxes in bounded batches and prunes expired login tokens", async () => {
    const { createDemoSandbox, consumeDemoSandboxLogin, cleanupExpiredDemoSandboxes } = await import("../../../../app/lib/demo/demo-sandboxes");
    const { getDatabase } = await import("../../../../app/lib/logbook-store");
    const firstLogin = await createDemoSandbox();
    const secondLogin = await createDemoSandbox();
    const activeLogin = await createDemoSandbox();
    const first = await consumeDemoSandboxLogin(firstLogin.token);
    const second = await consumeDemoSandboxLogin(secondLogin.token);
    const active = await consumeDemoSandboxLogin(activeLogin.token);
    const db = getDatabase();
    await db.query("update demo_sandboxes set expires_at = ? where user_id in (?, ?)", ["2000-01-01T00:00:00.000Z", first!.id, second!.id]);
    await db.query("update demo_login_tokens set expires_at = ?", ["2000-01-01T00:00:00.000Z"]);

    await expect(cleanupExpiredDemoSandboxes({ limit: 1 })).resolves.toEqual({ sandboxesDeleted: 1, loginTokensDeleted: 3 });
    expect((await db.query<{ id: string }>("select id from users where id in (?, ?)", [first!.id, second!.id])).rows).toHaveLength(1);
    expect((await db.query<{ id: string }>("select id from users where id = ?", [active!.id])).rows).toHaveLength(1);
    await expect(cleanupExpiredDemoSandboxes({ limit: 1 })).resolves.toEqual({ sandboxesDeleted: 1, loginTokensDeleted: 0 });
    expect((await db.query<{ id: string }>("select id from users where id in (?, ?)", [first!.id, second!.id])).rows).toHaveLength(0);
  });
});

function withoutConcurrencyMetadata(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutConcurrencyMetadata);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !["revision", "createdAt", "updatedAt"].includes(key)).map(([key, item]) => [key, withoutConcurrencyMetadata(item)]));
}

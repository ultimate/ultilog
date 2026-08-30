import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SqliteLogbookDatabase } from "../../../../app/lib/db/sqlite-logbook-database";
import { getUserComplianceState, selectUserComplianceLicense, setManualRequirementCompleted, setUserComplianceLicenseStartDate } from "../../../../app/lib/compliance";

const directories: string[] = [];
async function database() {
  const directory = await mkdtemp(join(tmpdir(), "ultilog-compliance-"));
  directories.push(directory);
  const db = new SqliteLogbookDatabase(join(directory, "db.sqlite"));
  await db.migrate();
  await db.query("insert into users (id, name, email, password_hash) values (?, ?, ?, ?)", ["user-1", "User", "user@example.test", "hash"]);
  return db;
}

afterEach(async () => Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))));

describe("user compliance state", () => {
  it("validates catalog IDs and only permits manual requirements", async () => {
    const db = await database();
    await expect(selectUserComplianceLicense("user-1", "unknown", true, db)).rejects.toThrow("License ID");
    await expect(setManualRequirementCompleted("user-1", "de-sks", "unknown", true, db)).rejects.toThrow("Requirement ID");
    await expect(setManualRequirementCompleted("user-1", "de-sks", "de-SportSeeSchV-6-1-2", true, db)).rejects.toThrow("Only manual");
  });

  it("tracks multiple licenses with independent completion and start dates", async () => {
    const db = await database();
    await selectUserComplianceLicense("user-1", "de-sks", true, db);
    await selectUserComplianceLicense("user-1", "de-sss", true, db);
    await setUserComplianceLicenseStartDate("user-1", "de-sks", "2026-02-01", db);
    await setManualRequirementCompleted("user-1", "de-sks", "de-SportSeeSchV-6-1-1", true, db);
    expect(await getUserComplianceState("user-1", db)).toEqual({ licenses: [
      { licenseId: "de-sks", startDate: "2026-02-01", completedManualRequirementIds: ["de-SportSeeSchV-6-1-1"] },
      { licenseId: "de-sss", startDate: null, completedManualRequirementIds: [] },
    ] });
    await selectUserComplianceLicense("user-1", "de-sks", false, db);
    expect((await getUserComplianceState("user-1", db)).licenses.map(({ licenseId }) => licenseId)).toEqual(["de-sss"]);
  });

  it("clears stale selected and completed catalog IDs", async () => {
    const db = await database();
    await db.query("insert into user_compliance_licenses (user_id, license_id) values (?, ?)", ["user-1", "retired-license"]);
    await db.query("insert into user_compliance_manual_requirements (user_id, license_id, requirement_id) values (?, ?, ?)", ["user-1", "de-sks", "retired-requirement"]);
    expect(await getUserComplianceState("user-1", db)).toEqual({ licenses: [] });
    expect((await db.query("select * from user_compliance_manual_requirements")).rows).toEqual([]);
  });
});

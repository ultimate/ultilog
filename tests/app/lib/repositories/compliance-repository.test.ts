import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SqliteLogbookDatabase } from "../../../../app/lib/db/sqlite-logbook-database";
import { getUserComplianceState, selectUserComplianceLicense, setManualRequirementCompleted } from "../../../../app/lib/compliance";

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
    await expect(selectUserComplianceLicense("user-1", "unknown", db)).rejects.toThrow("License ID");
    await expect(setManualRequirementCompleted("user-1", "de-sks", "unknown", true, db)).rejects.toThrow("Requirement ID");
    await expect(setManualRequirementCompleted("user-1", "de-sks", "de-SportSeeSchV-6-1-2", true, db)).rejects.toThrow("Only manual");
  });

  it("isolates completion by license and restores it when switching back", async () => {
    const db = await database();
    await selectUserComplianceLicense("user-1", "de-sks", db);
    await setManualRequirementCompleted("user-1", "de-sks", "de-SportSeeSchV-6-1-1", true, db);
    await selectUserComplianceLicense("user-1", "de-sss", db);
    expect(await getUserComplianceState("user-1", db)).toEqual({ selectedLicenseId: "de-sss", completedManualRequirementIds: [] });
    await setManualRequirementCompleted("user-1", "de-sss", "de-SportSeeSchV-6-2-1", true, db);
    await selectUserComplianceLicense("user-1", "de-sks", db);
    expect(await getUserComplianceState("user-1", db)).toEqual({ selectedLicenseId: "de-sks", completedManualRequirementIds: ["de-SportSeeSchV-6-1-1"] });
    await setManualRequirementCompleted("user-1", "de-sks", "de-SportSeeSchV-6-1-1", false, db);
    expect((await getUserComplianceState("user-1", db)).completedManualRequirementIds).toEqual([]);
  });

  it("clears stale selected and completed catalog IDs", async () => {
    const db = await database();
    await db.query("update users set selected_compliance_license_id = ? where id = ?", ["retired-license", "user-1"]);
    await db.query("insert into user_compliance_manual_requirements (user_id, license_id, requirement_id) values (?, ?, ?)", ["user-1", "de-sks", "retired-requirement"]);
    expect(await getUserComplianceState("user-1", db)).toEqual({ selectedLicenseId: null, completedManualRequirementIds: [] });
    expect((await db.query("select * from user_compliance_manual_requirements")).rows).toEqual([]);
  });
});

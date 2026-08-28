import { complianceCatalog, findLicense } from "../domain/compliance/catalog";
import type { QueryableDatabase } from "./db/logbook-database";
import { getDatabase } from "./logbook-store";
import { ComplianceRepository, type UserComplianceState } from "./repositories/compliance-repository";

async function repository(database: QueryableDatabase = getDatabase()) {
  if ("migrate" in database && typeof database.migrate === "function") await database.migrate();
  return new ComplianceRepository(database);
}

function knownLicense(licenseId: unknown) {
  if (typeof licenseId !== "string" || !findLicense(licenseId)) throw new Error("License ID is not recognized.");
  return findLicense(licenseId)!;
}

function manualRequirement(licenseId: unknown, requirementId: unknown) {
  const license = knownLicense(licenseId);
  if (typeof requirementId !== "string") throw new Error("Requirement ID is not recognized.");
  const requirement = license.requirements.find(({ id }) => id === requirementId);
  if (!requirement) throw new Error("Requirement ID is not recognized for this license.");
  if (requirement.type !== "manual") throw new Error("Only manual requirements can be updated.");
  return { license, requirement };
}

export async function getUserComplianceState(userId: string, database?: QueryableDatabase): Promise<UserComplianceState> {
  const repo = await repository(database);
  let selectedLicenseId = await repo.selectedLicense(userId);
  if (selectedLicenseId && !findLicense(selectedLicenseId)) {
    await repo.selectLicense(userId, null);
    selectedLicenseId = null;
  }

  const rows = await repo.completedRequirements(userId);
  const stale = rows.filter((row) => !findLicense(row.license_id)?.requirements.some((requirement) => requirement.id === row.requirement_id && requirement.type === "manual"));
  if (stale.length) await repo.deleteRequirements(userId, stale);
  return {
    selectedLicenseId,
    completedManualRequirementIds: selectedLicenseId
      ? rows.filter((row) => row.license_id === selectedLicenseId && !stale.includes(row)).map((row) => row.requirement_id)
      : [],
  };
}

export async function selectUserComplianceLicense(userId: string, licenseId: unknown, database?: QueryableDatabase) {
  if (licenseId !== null) knownLicense(licenseId);
  const repo = await repository(database);
  await repo.selectLicense(userId, licenseId as string | null);
  return getUserComplianceState(userId, database);
}

export async function setManualRequirementCompleted(userId: string, licenseId: unknown, requirementId: unknown, completed: unknown, database?: QueryableDatabase) {
  const validated = manualRequirement(licenseId, requirementId);
  if (typeof completed !== "boolean") throw new Error("Completed must be a boolean.");
  const repo = await repository(database);
  if (completed) await repo.markRequirement(userId, validated.license.id, validated.requirement.id);
  else await repo.unmarkRequirement(userId, validated.license.id, validated.requirement.id);
  return getUserComplianceState(userId, database);
}

export const complianceLicenseIds = complianceCatalog.licenses.map(({ id }) => id);

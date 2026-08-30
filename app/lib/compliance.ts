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
  const tracked = await repo.trackedLicenses(userId);
  const staleLicenses = tracked.filter(({ license_id }) => !findLicense(license_id)).map(({ license_id }) => license_id);
  if (staleLicenses.length) await repo.deleteTrackedLicenses(userId, staleLicenses);
  const rows = await repo.completedRequirements(userId);
  const stale = rows.filter((row) => !findLicense(row.license_id)?.requirements.some((requirement) => requirement.id === row.requirement_id && requirement.type === "manual"));
  if (stale.length) await repo.deleteRequirements(userId, stale);
  return {
    licenses: tracked.filter(({ license_id }) => !staleLicenses.includes(license_id)).map((entry) => ({
      licenseId: entry.license_id,
      startDate: entry.start_date,
      completedManualRequirementIds: rows.filter((row) => row.license_id === entry.license_id && !stale.includes(row)).map((row) => row.requirement_id),
    })),
  };
}

export async function selectUserComplianceLicense(userId: string, licenseId: unknown, selected = true, database?: QueryableDatabase) {
  const license = knownLicense(licenseId);
  if (typeof selected !== "boolean") throw new Error("Selected must be a boolean.");
  const repo = await repository(database);
  if (selected) await repo.trackLicense(userId, license.id);
  else await repo.untrackLicense(userId, license.id);
  return getUserComplianceState(userId, database);
}

export async function setUserComplianceLicenseStartDate(userId: string, licenseId: unknown, startDate: unknown, database?: QueryableDatabase) {
  const license = knownLicense(licenseId);
  const parsed = typeof startDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? new Date(`${startDate}T00:00:00Z`) : undefined;
  if (startDate !== null && (!parsed || !Number.isFinite(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== startDate)) throw new Error("Start date must be a valid calendar date or null.");
  const repo = await repository(database);
  if (!(await repo.trackedLicenses(userId)).some(({ license_id }) => license_id === license.id)) throw new Error("License must be tracked before setting its start date.");
  await repo.setStartDate(userId, license.id, startDate as string | null);
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

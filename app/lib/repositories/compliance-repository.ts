import type { QueryableDatabase } from "../db/logbook-database";

type SelectedLicenseRow = { selected_compliance_license_id: string | null };
type RequirementRow = { license_id: string; requirement_id: string };

export type UserComplianceState = {
  selectedLicenseId: string | null;
  completedManualRequirementIds: string[];
};

export class ComplianceRepository {
  constructor(private readonly db: QueryableDatabase) {}

  async selectedLicense(userId: string) {
    return (await this.db.query<SelectedLicenseRow>(
      `select selected_compliance_license_id from users where id = ${this.db.placeholder(1)}`,
      [userId],
    )).rows[0]?.selected_compliance_license_id ?? null;
  }

  async selectLicense(userId: string, licenseId: string | null) {
    await this.db.query(
      `update users set selected_compliance_license_id = ${this.db.placeholder(1)} where id = ${this.db.placeholder(2)}`,
      [licenseId, userId],
    );
  }

  async completedRequirements(userId: string, licenseId?: string) {
    const values: unknown[] = [userId];
    const licenseClause = licenseId === undefined ? "" : ` and license_id = ${this.db.placeholder(2)}`;
    if (licenseId !== undefined) values.push(licenseId);
    return (await this.db.query<RequirementRow>(
      `select license_id, requirement_id from user_compliance_manual_requirements where user_id = ${this.db.placeholder(1)}${licenseClause} order by license_id, requirement_id`,
      values,
    )).rows;
  }

  async markRequirement(userId: string, licenseId: string, requirementId: string) {
    await this.db.query(
      `insert into user_compliance_manual_requirements (user_id, license_id, requirement_id) values (${this.db.placeholder(1)}, ${this.db.placeholder(2)}, ${this.db.placeholder(3)}) on conflict (user_id, license_id, requirement_id) do nothing`,
      [userId, licenseId, requirementId],
    );
  }

  async unmarkRequirement(userId: string, licenseId: string, requirementId: string) {
    await this.db.query(
      `delete from user_compliance_manual_requirements where user_id = ${this.db.placeholder(1)} and license_id = ${this.db.placeholder(2)} and requirement_id = ${this.db.placeholder(3)}`,
      [userId, licenseId, requirementId],
    );
  }

  async deleteRequirements(userId: string, rows: RequirementRow[]) {
    for (const row of rows) await this.unmarkRequirement(userId, row.license_id, row.requirement_id);
  }
}

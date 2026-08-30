import type { QueryableDatabase } from "../db/logbook-database";

type RequirementRow = { license_id: string; requirement_id: string };
type TrackedLicenseRow = { license_id: string; start_date: string | null };

export type UserComplianceState = {
  licenses: Array<{ licenseId: string; startDate: string | null; completedManualRequirementIds: string[] }>;
};

export class ComplianceRepository {
  constructor(private readonly db: QueryableDatabase) {}

  async trackedLicenses(userId: string) {
    return (await this.db.query<TrackedLicenseRow>(
      `select license_id, start_date from user_compliance_licenses where user_id = ${this.db.placeholder(1)} order by selected_at, license_id`, [userId],
    )).rows;
  }

  async trackLicense(userId: string, licenseId: string) {
    await this.db.query(
      `insert into user_compliance_licenses (user_id, license_id) values (${this.db.placeholder(1)}, ${this.db.placeholder(2)}) on conflict (user_id, license_id) do nothing`, [userId, licenseId],
    );
  }

  async untrackLicense(userId: string, licenseId: string) {
    await this.db.query(`delete from user_compliance_licenses where user_id = ${this.db.placeholder(1)} and license_id = ${this.db.placeholder(2)}`, [userId, licenseId]);
  }

  async setStartDate(userId: string, licenseId: string, startDate: string | null) {
    await this.db.query(`update user_compliance_licenses set start_date = ${this.db.placeholder(1)} where user_id = ${this.db.placeholder(2)} and license_id = ${this.db.placeholder(3)}`, [startDate, userId, licenseId]);
  }

  async deleteTrackedLicenses(userId: string, licenseIds: string[]) {
    for (const licenseId of licenseIds) await this.untrackLicense(userId, licenseId);
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

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { complianceCatalog } from "../../app/domain/compliance/catalog";
import { calculateLicenseProgress } from "../../app/domain/compliance/license-progress";
import { LogSheetsRepository } from "../../app/lib/repositories/log-sheets-repository";
import type { BoatRow, LogLineRow, LogSheetRow } from "../../app/models/logbook";

const load = <T,>(day: number, suffix: string): T[] => JSON.parse(readFileSync(join(process.cwd(), "tests/fixtures/logbook-scanner/real-world", `2026-07-${day}_Respocean_${suffix}.json`), "utf8"));
const sheets = Array.from({ length: 6 }, (_, index) => load<LogSheetRow>(12 + index, "log_sheet")).flat();
const lines = Array.from({ length: 6 }, (_, index) => load<LogLineRow>(12 + index, "log_lines")).flat();

describe("Respocean compliance mileage", () => {
  it("counts 215.9 nm from the six July 2026 voyages after the March 7 exam", () => {
    const boat = { id: sheets[0].boat_id, name: "Lazy Bone", type: "sail", registration: "", flag_state: "", home_port: "", owner: "", dimensions: "" } as BoatRow;
    const logbook = LogSheetsRepository.toLogbook([boat], sheets, [], lines);
    const license = complianceCatalog.licenses.find(license => license.id === "ch-hochseeausweis-sail")!;
    const progress = calculateLicenseProgress(license.requirements, logbook.sheets, [], "2026-03-07", undefined, logbook.boats);
    for (const id of ["ch-7-a-2-1", "ch-7-a-2-2"]) {
      const result = progress.find(item => item.requirement.id === id)!;
      expect(result.achievedValue).toBeCloseTo(215.9, 6);
      expect(result.verification).toBe("automatic");
    }
  });
});

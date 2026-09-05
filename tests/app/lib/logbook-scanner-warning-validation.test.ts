import { describe, expect, it } from "vitest";
import { validatePersistedLogbook } from "../../../app/lib/validation/logbook";

const warningLogbook = (scannerWarnings: unknown) => ({
  boats: [{ id: "boat", name: "Boat", type: "Sail", registration: "", flagState: "", homePort: "", owner: "", dimensions: "", logfactor: 1, yachtData: {}, deviationTable: [] }],
  crewMembers: [],
  sheets: [{ id: "sheet", title: "Sheet", status: "Draft", source: "scanner", boatId: "boat", route: { from: "", to: "", departed: "", arrived: "" }, crew: [], watchPlan: [], technicalChecks: [], lines: [], scannerWarnings }],
});

describe("structured scanner warning validation", () => {
  it("accepts coded diagnostics with acknowledgment metadata", () => {
    expect(validatePersistedLogbook(warningLogbook([{ id: "warning", code: "missingFields", row: 1, fields: ["latitude"], acknowledgedAt: "2026-09-05T08:00:00Z" }])).sheets[0].scannerWarnings).toHaveLength(1);
  });

  it.each([
    [{ id: "warning", code: "not-a-code" }],
    [{ id: "warning", code: "missingFields", row: 0, fields: ["latitude"] }],
    [{ id: "warning", code: "missingFields", row: 1, fields: ["unknownField"] }],
    [{ id: "warning", code: "scannerGenerated" }],
    [{ id: "warning", code: "noRows", acknowledgedAt: "yesterday" }],
  ])("rejects malformed warning records", scannerWarnings => {
    expect(() => validatePersistedLogbook(warningLogbook(scannerWarnings))).toThrow("optional values are malformed");
  });
});

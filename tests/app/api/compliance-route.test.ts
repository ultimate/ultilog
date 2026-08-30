import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

vi.mock("../../../auth", () => ({ auth: vi.fn() }));
vi.mock("../../../app/lib/compliance", () => ({
  getUserComplianceState: vi.fn(),
  selectUserComplianceLicense: vi.fn(),
  setManualRequirementCompleted: vi.fn(),
  setUserComplianceLicenseStartDate: vi.fn(),
}));

const { auth } = await import("../../../auth");
const compliance = await import("../../../app/lib/compliance");
const { GET, PATCH } = await import("../../../app/api/compliance/route");
const state = { licenses: [{ licenseId: "de-sks", startDate: null, completedManualRequirementIds: ["de-SportSeeSchV-6-1-1"] }] };
const mockedAuth = auth as unknown as Mock;

describe("compliance API", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires authentication for reads and writes", async () => {
    mockedAuth.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect((await PATCH(new Request("https://ultilog.test/api/compliance", { method: "PATCH", body: "{}" }))).status).toBe(401);
  });

  it("returns authenticated compliance application data", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" }, expires: "2099-01-01" });
    vi.mocked(compliance.getUserComplianceState).mockResolvedValue(state);
    const response = await GET();
    await expect(response.json()).resolves.toEqual(state);
    expect(compliance.getUserComplianceState).toHaveBeenCalledWith("user-1");
  });

  it("passes only server-validated operation fields to the domain", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" }, expires: "2099-01-01" });
    vi.mocked(compliance.selectUserComplianceLicense).mockResolvedValue(state);
    vi.mocked(compliance.setManualRequirementCompleted).mockResolvedValue(state);
    const select = await PATCH(new Request("https://ultilog.test/api/compliance", { method: "PATCH", body: JSON.stringify({ action: "select-license", licenseId: "de-sks", selected: true, requirements: ["forged"] }) }));
    expect(select.status).toBe(200);
    expect(compliance.selectUserComplianceLicense).toHaveBeenCalledWith("user-1", "de-sks", true);
    const toggle = await PATCH(new Request("https://ultilog.test/api/compliance", { method: "PATCH", body: JSON.stringify({ action: "manual-requirement", licenseId: "de-sks", requirementId: "de-SportSeeSchV-6-1-1", completed: true, type: "manual" }) }));
    expect(toggle.status).toBe(200);
    expect(compliance.setManualRequirementCompleted).toHaveBeenCalledWith("user-1", "de-sks", "de-SportSeeSchV-6-1-1", true);
  });

  it("rejects malformed and invalid updates", async () => {
    mockedAuth.mockResolvedValue({ user: { id: "user-1" }, expires: "2099-01-01" });
    vi.mocked(compliance.selectUserComplianceLicense).mockRejectedValue(new Error("License ID is not recognized."));
    const malformed = await PATCH(new Request("https://ultilog.test/api/compliance", { method: "PATCH", body: JSON.stringify({ action: "select-license", licenseId: 123, selected: true }) }));
    expect(malformed.status).toBe(400);
    const invalid = await PATCH(new Request("https://ultilog.test/api/compliance", { method: "PATCH", body: JSON.stringify({ action: "select-license", licenseId: "unknown", selected: true }) }));
    expect(invalid.status).toBe(400);
  });
});

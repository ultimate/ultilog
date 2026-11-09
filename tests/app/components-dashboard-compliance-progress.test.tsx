import { act, create } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../app/lib/i18n";
import { DashboardComplianceProgress } from "../../app/components/logbook/compliance/DashboardComplianceProgress";

const response = (body: object) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);

describe("DashboardComplianceProgress", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal("document", { documentElement: { lang: "" } });
    vi.stubGlobal("window", { localStorage: { getItem: vi.fn(), setItem: vi.fn() } });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("shows the today fallback for an initial license with no reference date", async () => {
    vi.stubGlobal("fetch", vi.fn(() => response({ licenses: [{ licenseId: "ch-hochseeausweis-sail", startDate: null, completedManualRequirementIds: [] }] })));
    let root!: ReturnType<typeof create>;
    await act(async () => { root = create(<I18nProvider><DashboardComplianceProgress sheets={[]} language="en" onOpenCompliance={() => {}} /></I18nProvider>); });
    expect(JSON.stringify(root.toJSON())).toContain("Uses today when left blank.");
  });

  it("uses today for an add-on with no application date instead of prompting for one", async () => {
    vi.stubGlobal("fetch", vi.fn(() => response({ licenses: [{ licenseId: "ch-hochseeausweis-sail-addon", startDate: null, completedManualRequirementIds: [] }] })));
    let root!: ReturnType<typeof create>;
    await act(async () => { root = create(<I18nProvider><DashboardComplianceProgress sheets={[]} language="en" onOpenCompliance={() => {}} /></I18nProvider>); });
    const text = JSON.stringify(root.toJSON());
    expect(text).toContain("Uses today when left blank.");
    expect(text).not.toContain("Enter the reference date to calculate progress.");
  });

  it("shows every persisted license, an overall pie, and a compliance details action", async () => {
    vi.stubGlobal("fetch", vi.fn(() => response({ licenses: [
      { licenseId: "de-sks", startDate: null, completedManualRequirementIds: ["de-SportSeeSchV-6-1-1"] },
      { licenseId: "de-sss", startDate: "2026-01-01", completedManualRequirementIds: [] },
    ] })));
    const onOpenCompliance = vi.fn();
    let root!: ReturnType<typeof create>;
    await act(async () => { root = create(<I18nProvider><DashboardComplianceProgress sheets={[]} language="de" onOpenCompliance={onOpenCompliance} /></I18nProvider>); });
    expect(root.root.findAllByProps({ className: "license-status-pie" })).toHaveLength(3);
    expect(root.root.findAllByProps({ className: "dashboard-license-grid" })[0].findAllByType("article")).toHaveLength(2);
    root.root.findByType("button").props.onClick();
    expect(onOpenCompliance).toHaveBeenCalledOnce();
  });
});

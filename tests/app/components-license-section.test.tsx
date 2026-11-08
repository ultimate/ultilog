import { act, create } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../app/lib/i18n";
import { LicenseSection } from "../../app/components/logbook/compliance/LicenseSection";

const response = (body: object, ok = true) => Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response);
const state = { licenses: [{ licenseId: "de-sks", startDate: null, completedManualRequirementIds: [] as string[] }] };

describe("LicenseSection", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal("document", { documentElement: { lang: "" } });
    vi.stubGlobal("window", { localStorage: { getItem: vi.fn(), setItem: vi.fn() } });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("shows automatic after-theory progress with its targets, units, and counting filters", async () => {
    vi.stubGlobal("fetch", vi.fn(() => response({ licenses: [
      { licenseId: "ch-hochseeausweis-sail", startDate: "2021-07-01", completedManualRequirementIds: [] },
      { licenseId: "ch-hochseeausweis-motor", startDate: "2021-07-01", completedManualRequirementIds: [] },
    ] })));
    let root!: ReturnType<typeof create>;
    await act(async () => { root = create(<I18nProvider><LicenseSection requestedLanguage="en" sheets={[]} /></I18nProvider>); });
    const sail = root.root.findByProps({ id: "requirement-copy-ch-7-a-2-2" });
    expect(sail.findAllByType("dd").map(node => node.children.join(""))).toEqual(["700 nautical miles", "Reference date", "End of year · 4 years after the reference date", "01/07/2021 – 31/12/2025", "Sail"]);
    const motor = root.root.findByProps({ id: "requirement-copy-ch-7-b-2-2" });
    expect(motor.findAllByType("dd").map(node => node.children.join(""))).toEqual(["400 nautical miles", "Reference date", "End of year · 4 years after the reference date", "01/07/2021 – 31/12/2025", "Motor"]);
    expect(root.root.findByProps({ id: "requirement-copy-ch-2-b" }).findAllByType("dl")).toHaveLength(0);
    expect(root.root.findAllByProps({ "aria-describedby": sail.props.id })).toHaveLength(0);
    for (const copy of [sail, motor]) {
      expect(copy.parent!.findAllByType("progress")).toHaveLength(1);
      expect(copy.parent!.findAllByProps({ type: "checkbox" })).toHaveLength(0);
    }
  });

  it("renders and saves the handwritten-logbook confirmation independently for all four Swiss licenses", async () => {
    let licenses = ["ch-hochseeausweis-sail", "ch-hochseeausweis-motor", "ch-hochseeausweis-sail-addon", "ch-hochseeausweis-motor-addon"].map(licenseId => ({ licenseId, startDate: null, completedManualRequirementIds: [] as string[] }));
    vi.stubGlobal("fetch", vi.fn((_url, options?: RequestInit) => {
      if (options) {
        const body = JSON.parse(String(options.body));
        licenses = licenses.map(license => license.licenseId === body.licenseId ? { ...license, completedManualRequirementIds: [body.requirementId] } : license);
      }
      return response({ licenses });
    }));
    let root!: ReturnType<typeof create>;
    await act(async () => { root = create(<I18nProvider><LicenseSection requestedLanguage="en" sheets={[]} /></I18nProvider>); });
    const label = "Handwritten logbook for voyages counted toward the license";
    expect(root.root.findAllByProps({ type: "checkbox", "aria-label": label })).toHaveLength(4);
    await act(async () => { root.root.findAllByProps({ type: "checkbox", "aria-label": label })[0].props.onChange({ target: { checked: true } }); });
    expect(licenses.map(license => license.completedManualRequirementIds)).toEqual([["ch-hochseeausweis-sail-handwritten-logbook"], [], [], []]);
    expect(root.root.findAllByProps({ type: "checkbox", "aria-label": label }).map(node => node.props.checked)).toEqual([true, false, false, false]);
  });

  it("persists manual requirements and never renders automatic requirements as checkboxes", async () => {
    const fetch = vi.fn().mockImplementation((_url, options?: RequestInit) => {
      if (!options) return response(state);
      const body = JSON.parse(String(options.body));
      return response({ licenses: state.licenses.map((license) => ({ ...license, completedManualRequirementIds: body.action === "manual-requirement" ? [body.requirementId] : [] })) });
    });
    vi.stubGlobal("fetch", fetch);
    let root!: ReturnType<typeof create>;
    await act(async () => { root = create(<I18nProvider><LicenseSection requestedLanguage="en" sheets={[]} /></I18nProvider>); });
    const requirements = root.root.findAll((node) => typeof node.props.className === "string" && node.props.className.includes("requirement-row"));
    const manual = requirements.filter((node) => node.findAllByType("input").length);
    const automatic = requirements.filter((node) => node.findAllByType("progress").length);
    expect(manual.length).toBeGreaterThan(0);
    expect(automatic.length).toBeGreaterThan(0);
    expect(automatic.every((node) => node.findAllByType("input").length === 0)).toBe(true);
    await act(async () => { manual[0].findByType("input").props.onChange({ target: { checked: true } }); });
    expect(fetch).toHaveBeenLastCalledWith("/api/compliance", expect.objectContaining({ method: "PATCH", body: expect.stringContaining('"action":"manual-requirement"') }));
    expect(root.root.findAllByProps({ type: "checkbox" })[0].props.checked).toBe(true);
  });

  it("announces authenticated API failures without changing manual state", async () => {
    const fetch = vi.fn().mockImplementation((_url, options?: RequestInit) => options
      ? response({ error: "Progress could not be saved" }, false)
      : response(state));
    vi.stubGlobal("fetch", fetch);
    let root!: ReturnType<typeof create>;
    await act(async () => { root = create(<I18nProvider><LicenseSection requestedLanguage="de" sheets={[]} /></I18nProvider>); });
    const checkbox = root.root.findAllByProps({ type: "checkbox" })[0];
    await act(async () => { checkbox.props.onChange({ target: { checked: true } }); });
    expect(root.root.findByProps({ role: "alert" }).children.join("")).toContain("Progress could not be saved");
    expect(root.root.findAllByProps({ type: "checkbox" })[0].props.checked).toBe(false);
  });

  it("restores multiple tracked licenses and persists each license start date", async () => {
    const multiple = { licenses: [
      state.licenses[0],
      { licenseId: "de-sss", startDate: "2026-03-01", completedManualRequirementIds: [] },
    ] };
    const fetch = vi.fn().mockImplementation((_url, options?: RequestInit) => response(options ? multiple : multiple));
    vi.stubGlobal("fetch", fetch);
    let root!: ReturnType<typeof create>;
    await act(async () => { root = create(<I18nProvider><LicenseSection requestedLanguage="de" sheets={[]} /></I18nProvider>); });
    expect(root.root.findAllByProps({ className: "tracked-license" })).toHaveLength(2);
    expect(root.root.findAllByType("details")).toHaveLength(2);
    expect(root.root.findAllByProps({ className: "license-status-pie" })).toHaveLength(2);
    const startDates = root.root.findAllByProps({ type: "date" });
    expect(startDates[1].props.value).toBe("2026-03-01");
    await act(async () => { startDates[0].props.onChange({ target: { value: "2026-04-02" }, currentTarget: { value: "2026-04-02" } }); });
    expect(fetch).toHaveBeenCalledTimes(1);
    await act(async () => { root.root.findAllByProps({ type: "date" })[0].props.onBlur({ target: {}, currentTarget: {} }); });
    expect(fetch).toHaveBeenLastCalledWith("/api/compliance", expect.objectContaining({ body: expect.stringContaining('"action":"license-start-date"') }));
  });
});

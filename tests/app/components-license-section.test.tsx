import { act, create } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../app/lib/i18n";
import { LicenseSection } from "../../app/components/logbook/compliance/LicenseSection";

const response = (body: object, ok = true) => Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response);
const state = { selectedLicenseId: "de-sks", completedManualRequirementIds: [] as string[] };

describe("LicenseSection", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal("document", { documentElement: { lang: "" } });
    vi.stubGlobal("window", { localStorage: { getItem: vi.fn(), setItem: vi.fn() } });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("persists manual requirements and never renders automatic requirements as checkboxes", async () => {
    const fetch = vi.fn().mockImplementation((_url, options?: RequestInit) => {
      if (!options) return response(state);
      const body = JSON.parse(String(options.body));
      return response({ ...state, completedManualRequirementIds: body.action === "manual-requirement" ? [body.requirementId] : [] });
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
    expect(root.root.findAllByType("input")[0].props.checked).toBe(true);
  });

  it("announces authenticated API failures without changing manual state", async () => {
    const fetch = vi.fn().mockImplementation((_url, options?: RequestInit) => options
      ? response({ error: "Progress could not be saved" }, false)
      : response(state));
    vi.stubGlobal("fetch", fetch);
    let root!: ReturnType<typeof create>;
    await act(async () => { root = create(<I18nProvider><LicenseSection requestedLanguage="de" sheets={[]} /></I18nProvider>); });
    const checkbox = root.root.findAllByType("input")[0];
    await act(async () => { checkbox.props.onChange({ target: { checked: true } }); });
    expect(root.root.findByProps({ role: "alert" }).children.join("")).toContain("Progress could not be saved");
    expect(root.root.findAllByType("input")[0].props.checked).toBe(false);
  });
});

import { act, create } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../app/lib/i18n";
import type { Requirement } from "../../app/domain/compliance/catalog";
import { RequirementDetails } from "../../app/components/logbook/compliance/RequirementDetails";

const manual: Requirement = { id: "after-exam", type: "manual", translationKey: "compliance.requirement.afterTheoryExam", threshold: 700, unit: "nautical-miles", filters: { withinYears: 4, boatType: "sail", propulsion: "motor" } };

describe("requirement details", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal("document", { documentElement: { lang: "" } });
    vi.stubGlobal("window", { localStorage: { getItem: vi.fn(), setItem: vi.fn() } });
  });
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    ["en", "Within 4 years", "nautical miles"],
    ["de", "Innerhalb von 4 Jahren", "Seemeilen"],
    ["fr", "Dans un délai de 4 ans", "milles nautiques"],
    ["it", "Entro 4 anni", "miglia nautiche"],
  ])("localizes targets and all filter dimensions in %s", async (language, period, unit) => {
    vi.mocked(window.localStorage.getItem).mockReturnValue(language);
    let root!: ReturnType<typeof create>;
    await act(async () => { root = create(<I18nProvider><RequirementDetails requirement={manual} language={language} /></I18nProvider>); });
    const values = root.root.findAllByType("dd").map(node => node.children.join(""));
    expect(values[0]).toBe(`700 ${unit}`);
    expect(values[1]).toBe(period);
    expect(values).toHaveLength(4);
    expect(root.root.findAllByType("dt")).toHaveLength(4);
  });

  it("displays relative calendar boundaries and the same resolved range used for counting", async () => {
    const requirement: Requirement = { ...manual, filters: { dateWindow: { from: { yearOffset: -4, boundary: "year-start" }, through: { yearOffset: 4, boundary: "year-end" } } } };
    let root!: ReturnType<typeof create>;
    await act(async () => { root = create(<I18nProvider><RequirementDetails requirement={requirement} language="en" referenceDate="2021-07-01" /></I18nProvider>); });
    expect(root.root.findAllByType("dd").map(node => node.children.join(""))).toEqual([
      "700 nautical miles", "Start of year · 4 years before the reference date", "End of year · 4 years after the reference date", "01/01/2017 – 31/12/2025",
    ]);
    await act(async () => { root.update(<I18nProvider><RequirementDetails requirement={requirement} language="en" /></I18nProvider>); });
    expect(root.root.findAllByType("dd")).toHaveLength(3);
  });

  it("shows the rolling eligible period when the date window defaults to today", async () => {
    const requirement: Requirement = { ...manual, filters: { dateWindow: { from: { yearOffset: -4, boundary: "year-start" }, through: { yearOffset: 0, boundary: "date" }, referenceDateFallback: "today" } } };
    let root!: ReturnType<typeof create>;
    await act(async () => { root = create(<I18nProvider><RequirementDetails requirement={requirement} language="en" /></I18nProvider>); });
    const today = new Date().toISOString().slice(0, 10);
    const [year, month, day] = today.split("-");
    expect(root.root.findAllByType("dd").map(node => node.children.join(""))).toContain(`01/01/${Number(year) - 4} – ${day}/${month}/${year}`);
  });

  it("shows a singular time filter without turning a boolean check into mileage", async () => {
    let root!: ReturnType<typeof create>;
    await act(async () => { root = create(<I18nProvider><RequirementDetails requirement={{ ...manual, threshold: 1, unit: undefined, filters: { withinYears: 1 } }} language="en" /></I18nProvider>); });
    expect(root.root.findAllByType("dd").map(node => node.children.join(""))).toEqual(["Within 1 year"]);
  });
});

import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lineToForm } from "../../app/components/logbook/forms";
import { CrewSearchSelect } from "../../app/components/logbook/CrewSearchSelect";
import { PreferenceDateTimeInput } from "../../app/components/logbook/PreferenceDateTimeInput";
import { DateTimeFormatProvider } from "../../app/lib/DateTimeFormatProvider";
import { LogbookDetailsPage } from "../../app/components/logbook/pages/LogbookDetailsPage";
import { sampleBoats, sampleLogSheets } from "../fixtures/logbook";

vi.mock("../../app/lib/i18n", async () => {
  const { t } = await import("../../app/lib/i18n/translations");
  return { useI18n: () => ({ locale: "en", t: (key: Parameters<typeof t>[1]) => t("en", key) }) };
});
vi.mock("../../app/components/logbook/OpenSeaMapView", () => ({ LogLinesMapView: () => null }));
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: ReactTestRenderer;
afterEach(async () => { await act(async () => root?.unmount()); vi.unstubAllGlobals(); });

describe("crew search", () => {
  it("filters by name, selects with the keyboard, resets and excludes removed results", async () => {
    const onSelect = vi.fn();
    const members = [{ id: "ada", name: "Ada Lovelace" }, { id: "grace", name: "Grace Hopper" }];
    await act(async () => { root = create(<CrewSearchSelect members={members} disabled={false} onSelect={onSelect} />); });
    const input = () => root.root.findByType("input");
    await act(async () => input().props.onChange({ target: { value: "HOP" } }));
    expect(root.root.findAllByProps({ role: "option" }).map(option => option.children.join(""))).toEqual(["Grace Hopper"]);
    await act(async () => input().props.onKeyDown({ key: "Enter", preventDefault: vi.fn() }));
    expect(onSelect).toHaveBeenCalledWith("grace");
    expect(input().props.value).toBe("");
    expect(input().props["aria-expanded"]).toBe(false);
    await act(async () => root.update(<CrewSearchSelect members={members.slice(0, 1)} disabled={false} onSelect={onSelect} />));
    await act(async () => input().props.onFocus());
    expect(root.root.findAllByProps({ role: "option" }).map(option => option.children.join(""))).toEqual(["Ada Lovelace"]);
  });
});

describe("date editor drafts", () => {
  it("retains invalid partial text without saving it and emits ISO values for complete input", async () => {
    const onChange = vi.fn();
    await act(async () => { root = create(<DateTimeFormatProvider dateFormat="dd.MM.yyyy" timeFormat="HH:mm"><PreferenceDateTimeInput value="2026-10-24T10:30" onChange={onChange} /></DateTimeFormatProvider>); });
    const input = () => root.root.findByProps({ type: "text" });
    expect(input().props.value).toBe("24.10.2026, 10:30");
    const setCustomValidity = vi.fn();
    await act(async () => input().props.onChange({ currentTarget: { value: "24.10.2026, 10:", setCustomValidity }, target: { value: "24.10.2026, 10:" } }));
    expect(onChange).not.toHaveBeenCalled();
    expect(input().props.value).toBe("24.10.2026, 10:");
    expect(setCustomValidity).toHaveBeenLastCalledWith(expect.any(String));
    await act(async () => input().props.onChange({ currentTarget: { value: "24.10.2026, 10:45", setCustomValidity }, target: { value: "24.10.2026, 10:45" } }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ target: expect.objectContaining({ value: "2026-10-24T10:45" }) }));
    expect(setCustomValidity).toHaveBeenLastCalledWith("");
  });
  it("uses the native chooser to replace invalid text and preserves second precision", async () => {
    const onChange = vi.fn();
    const render = (value: string, disabled = false, readOnly = false) => <DateTimeFormatProvider dateFormat="dd.MM.yyyy" timeFormat="HH:mm:ss"><PreferenceDateTimeInput value={value} aria-label="Departure" onChange={onChange} disabled={disabled} readOnly={readOnly} /></DateTimeFormatProvider>;
    await act(async () => { root = create(render("2026-10-24T10:30:27")); });
    const picker = () => root.root.findByProps({ type: "datetime-local" });
    expect(picker().props.value).toBe("2026-10-24T10:30:27");
    expect(picker().props.step).toBe(1);
    expect(picker().props["aria-label"]).toBe("Choose date and time: Departure");
    await act(async () => root.root.findByProps({ type: "text" }).props.onChange({ currentTarget: { value: "invalid", setCustomValidity: vi.fn() }, target: { value: "invalid" } }));
    const event = { currentTarget: { value: "2026-10-25T11:45:32", validity: { badInput: false } }, target: { value: "2026-10-25T11:45:32" } };
    await act(async () => picker().props.onChange(event));
    expect(onChange).toHaveBeenLastCalledWith(event);
    await act(async () => root.update(render(event.target.value)));
    expect(root.root.findByProps({ type: "text" }).props.value).toBe("25.10.2026, 11:45:32");
    await act(async () => root.update(render(event.target.value, true)));
    expect(picker().props.disabled).toBe(true);
    await act(async () => root.update(render(event.target.value, false, true)));
    expect(picker().props.disabled).toBe(true);
  });

});

describe("log sheet actions and warning review", () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    const target = new EventTarget();
    vi.stubGlobal("window", { location: { origin: "https://example.test" }, addEventListener: target.addEventListener.bind(target), removeEventListener: target.removeEventListener.bind(target), dispatchEvent: target.dispatchEvent.bind(target) });
    vi.stubGlobal("localStorage", { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) });
  });
  function props() {
    const sheet = { ...sampleLogSheets[0], crew: [], lines: [], technicalChecks: [], source: "scanner", scannerWarnings: [{ id: "missing-target", code: "missingFields", row: 99, fields: ["variation"] }] };
    return { isBackendReady: true, hasSelectedSheet: true, activeSheet: sheet, activeBoat: sampleBoats[0], logbook: { boats: sampleBoats, crewMembers: [], sheets: [sheet] }, lineForms: {}, technicalCheckSuggestions: [], coordinateFormat: "decimal", activeSheetSummary: { motorMiles: 0, sailMiles: 0, totalMiles: 0, duration: "", motionDuration: "", motorHoursDuration: "00:00" }, renderInlineTextField: (_field: string, text: string) => text, renderInlineBoatField: () => "Boat", renderInlineDateField: (_field: string, text: string) => text, previousSheetId: undefined, nextSheetId: "next", onNavigateSheet: vi.fn(), onPrintSheet: vi.fn(), updateScannerWarningDismissal: vi.fn().mockResolvedValue(true) };
  }
  const button = (label: string) => root.root.findAllByType("button").find(button => button.props["aria-label"] === label)!;
  it("uses icon labels, disables boundary arrows and remembers collapsed actions", async () => {
    const input = props();
    await act(async () => { root = create(<LogbookDetailsPage {...input} />); });
    expect(button("Previous log sheet").props.disabled).toBe(true);
    expect(button("Next log sheet").props.disabled).toBe(false);
    await act(async () => button("Next log sheet").props.onClick());
    expect(input.onNavigateSheet).toHaveBeenCalledWith("next");
    expect(button("Share log sheet").props.title).toBe("Share log sheet");
    await act(async () => button("Collapse actions").props.onClick());
    expect(root.root.findByProps({ id: "sheet-action-buttons" }).props.hidden).toBe(true);
    expect(localStorage.getItem("ultilog.sheetActionsCollapsed")).toBe("true");
    await act(async () => root.unmount());
    await act(async () => { root = create(<LogbookDetailsPage {...input} />); });
    expect(root.root.findByProps({ id: "sheet-action-buttons" }).props.hidden).toBe(true);
    expect(button("Expand actions").props["aria-expanded"]).toBe(false);
  });
  it("renders an optimistically inserted new line only once while its editor is open", async () => {
    const input = props();
    const line = sampleLogSheets[0].lines[0];
    await act(async () => { root = create(<LogbookDetailsPage {...input} activeSheet={{ ...input.activeSheet, lines: [line] }} lineForms={{ [line.id]: { form: lineToForm(line), isNew: true } }} />); });
    expect(root.root.findAllByProps({ className: "inline-line-row" })).toHaveLength(1);
  });

  it("keeps unsaved technical-log text when navigating", async () => {
    const input = props();
    await act(async () => { root = create(<LogbookDetailsPage {...input} />); });
    const text = root.root.findAllByType("input").find(input => input.props["aria-label"] === "New technical log entry")!;
    await act(async () => text.props.onChange({ target: { value: "Check coolant" } }));
    await act(async () => button("Next log sheet").props.onClick());
    expect(input.onNavigateSheet).not.toHaveBeenCalled();
    expect(root.root.findByProps({ role: "alert" }).children.join("")).toContain("Save or cancel");
    expect(root.root.findAllByType("input").find(input => input.props["aria-label"] === "New technical log entry")!.props.value).toBe("Check coolant");
  });

  it("excludes incomplete stored warnings from the list, count, and dismissal requirement", async () => {
    const input = props();
    const emptyWarnings = [{ id: "no-row", code: "missingFields", fields: ["latitude"] }, { id: "no-fields", code: "incompleteCourseChain", row: 2, fields: [] }];
    await act(async () => { root = create(<LogbookDetailsPage {...input} activeSheet={{ ...input.activeSheet, scannerWarnings: [...emptyWarnings, ...input.activeSheet.scannerWarnings] }} />); });
    expect(root.root.findAllByProps({ id: "scanner-warning-notice-no-row" })).toHaveLength(0);
    expect(root.root.findAllByProps({ id: "scanner-warning-notice-no-fields" })).toHaveLength(0);
    expect(root.root.findByProps({ className: "scanner-warning-progress" }).children.join("")).toBe("1 active of 1 total warnings");
    await act(async () => root.update(<LogbookDetailsPage {...input} activeSheet={{ ...input.activeSheet, scannerWarnings: emptyWarnings }} />));
    expect(root.root.findByProps({ className: "scanner-warning-progress" }).children.join("")).toBe("0 active of 0 total warnings");
    expect(root.root.findAllByType("button").some(button => button.children.includes("Do not show again"))).toBe(true);
  });

  it("lists warnings with missing rows and hidden fields and only permits dismissal when resolved", async () => {
    const input = props();
    await act(async () => { root = create(<LogbookDetailsPage {...input} />); });
    expect(root.root.findAllByProps({ id: "scanner-warning-notice-missing-target" })).toHaveLength(1);
    expect(JSON.stringify(root.toJSON())).not.toContain("Do not show again");
    const reviewed = { ...input.activeSheet, scannerWarnings: input.activeSheet.scannerWarnings.map(warning => ({ ...warning, acknowledgedAt: "2026-10-24T10:30:00Z" })) };
    await act(async () => root.update(<LogbookDetailsPage {...input} activeSheet={reviewed} />));
    const dismiss = root.root.findAllByType("button").find(button => button.children.includes("Do not show again"))!;
    await act(async () => dismiss.props.onClick());
    expect(input.updateScannerWarningDismissal).toHaveBeenCalledWith(true);
    await act(async () => root.update(<LogbookDetailsPage {...input} activeSheet={{ ...reviewed, scannerWarningsDismissed: true }} />));
    expect(root.root.findAllByProps({ className: "scanner-draft-notice logbook-section" })).toHaveLength(0);
    await act(async () => root.update(<LogbookDetailsPage {...input} activeSheet={{ ...input.activeSheet, scannerWarningsDismissed: true }} />));
    expect(root.root.findAllByProps({ id: "scanner-warning-notice-missing-target" })).toHaveLength(1);
  });
});

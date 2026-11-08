import { act, create } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../app/lib/i18n";
import { DateTimeFormatProvider } from "../../app/lib/DateTimeFormatProvider";
import { PreferenceDateInput } from "../../app/components/logbook/PreferenceDateInput";

const event = (value: string) => ({ target: { value }, currentTarget: { value, setCustomValidity: vi.fn() } });

describe("license date editing", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal("document", { documentElement: { lang: "" } });
    vi.stubGlobal("window", { localStorage: { getItem: vi.fn(), setItem: vi.fn() } });
  });
  afterEach(() => vi.unstubAllGlobals());

  it.each(["dd/MM/yyyy", "yyyy-MM-dd"] as const)("keeps partial edits local and commits a full date in %s", async dateFormat => {
    const onChange = vi.fn();
    let root!: ReturnType<typeof create>;
    await act(async () => { root = create(<I18nProvider><DateTimeFormatProvider dateFormat={dateFormat} timeFormat="HH:mm"><PreferenceDateInput commitOnBlur value="" onChange={onChange} /></DateTimeFormatProvider></I18nProvider>); });
    const date = dateFormat === "yyyy-MM-dd" ? "2026-04-02" : "02/04/2026";
    for (let length = 1; length <= date.length; length++) {
      const text = date.slice(0, length);
      await act(async () => { root.root.findByProps({ type: "text" }).props.onChange(event(text)); });
      expect(root.root.findByProps({ type: "text" }).props.value).toBe(text);
      expect(onChange).not.toHaveBeenCalled();
    }
    await act(async () => { root.root.findByProps({ type: "text" }).props.onBlur(event(date)); });
    expect(onChange.mock.calls[0][0].target.value).toBe("2026-04-02");
    // Without a successful parent update (e.g. a failed request), the draft survives.
    expect(root.root.findByProps({ type: "text" }).props.value).toBe(date);
  });

  it("does not commit invalid dates, but commits an explicit clear", async () => {
    const onChange = vi.fn();
    let root!: ReturnType<typeof create>;
    await act(async () => { root = create(<I18nProvider><PreferenceDateInput commitOnBlur value="2026-04-02" onChange={onChange} /></I18nProvider>); });
    await act(async () => { root.root.findByProps({ type: "text" }).props.onChange(event("31/02/2026")); });
    await act(async () => { root.root.findByProps({ type: "text" }).props.onBlur(event("31/02/2026")); });
    expect(onChange).not.toHaveBeenCalled();
    expect(root.root.findByProps({ type: "text" }).props["aria-invalid"]).toBe(true);
    await act(async () => { root.root.findByProps({ type: "text" }).props.onChange(event("")); });
    await act(async () => { root.root.findByProps({ type: "text" }).props.onBlur(event("")); });
    expect(onChange.mock.calls[0][0].target.value).toBe("");
  });
});

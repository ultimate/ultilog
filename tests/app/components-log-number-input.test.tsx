import { useState } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LogNumberInput } from "../../app/components/logbook/LogNumberInput";
import { formatDecimalInput, parseDecimalInput } from "../../app/lib/log-input";
import { coordinateToInput, parseCoordinate } from "../../app/domain/nautical/coordinates";

const language = vi.hoisted(() => ({ locale: "de" }));
vi.mock("../../app/lib/i18n", () => ({ useI18n: () => ({ locale: language.locale, t: (key: string) => key }) }));
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: ReactTestRenderer;
beforeEach(() => { language.locale = "de"; });
afterEach(async () => { await act(async () => root?.unmount()); });
function Editor({ initial, hours = false }: { initial: string; hours?: boolean }) {
  const [value, setValue] = useState(initial);
  return <LogNumberInput hours={hours} value={value} onChange={event => setValue(event.currentTarget.value)} />;
}
const input = () => root.root.findByType("input");
const event = (value: string) => {
  const target = { value, setCustomValidity: vi.fn(), validity: { valid: true } };
  return { currentTarget: target, target };
};

describe("localized numeric editors", () => {
  it.each(["en", "de", "fr", "it"])("matches the %s view separator when opening and focusing an editor", async locale => {
    language.locale = locale;
    await act(async () => { root = create(<Editor initial="1.5" />); });
    const expected = (1.5).toLocaleString(locale);
    expect(input().props.value).toBe(expected);
    await act(async () => input().props.onFocus(event(expected)));
    expect(input().props.value).toBe(expected);
  });
  it.each(["1.25", "1,25"])("accepts %s while typing and renders the locale separator after blur", async text => {
    await act(async () => { root = create(<Editor initial="1.5" />); });
    await act(async () => input().props.onFocus(event("1,5")));
    const change = event(text);
    await act(async () => input().props.onChange(change));
    expect(input().props.value).toBe(text);
    await act(async () => input().props.onBlur(change));
    expect(input().props.value).toBe("1,25");
    expect(parseDecimalInput(root.root.findByType(LogNumberInput).props.value)).toBe(1.25);
  });
  it("keeps partial and invalid input intact until it is corrected", async () => {
    await act(async () => { root = create(<Editor initial="1.5" />); });
    await act(async () => input().props.onFocus(event("1,5")));
    const partial = event("1.");
    await act(async () => input().props.onChange(partial));
    expect(input().props.value).toBe("1.");
    const invalid = event("1.2,3");
    await act(async () => input().props.onChange(invalid));
    await act(async () => input().props.onBlur(invalid));
    expect(input().props.value).toBe("1.2,3");
    expect(invalid.currentTarget.setCustomValidity).toHaveBeenLastCalledWith("details.invalidNumber");
  });
  it("updates unfocused editors when the language changes", async () => {
    await act(async () => { root = create(<Editor initial="1.50" />); });
    expect(input().props.value).toBe("1,50");
    language.locale = "en";
    await act(async () => root.update(<Editor initial="1.50" />));
    expect(input().props.value).toBe("1.50");
  });
  it("reflects external updates while focused without restoring an older value on blur", async () => {
    const onChange = vi.fn();
    await act(async () => { root = create(<LogNumberInput value="1.5" onChange={onChange} />); });
    await act(async () => input().props.onFocus(event("1,5")));
    await act(async () => root.update(<LogNumberInput value="2.5" onChange={onChange} />));
    expect(input().props.value).toBe("2,5");
    await act(async () => input().props.onBlur(event("2,5")));
    expect(input().props.value).toBe("2,5");
    expect(onChange.mock.calls.every(([event]) => event.currentTarget.value === "2,5")).toBe(true);
  });
  it("localizes default values without introducing grouping or changing precision", async () => {
    const value = "123456789.123456789";
    await act(async () => { root = create(<LogNumberInput defaultValue={value} />); });
    expect(input().props.value).toBe("123456789,123456789");
    const change = event("12.3000");
    await act(async () => input().props.onChange(change));
    await act(async () => input().props.onBlur(change));
    expect(input().props.value).toBe("12,3000");
  });
  it("keeps empty, zero and negative values distinct", () => {
    expect(formatDecimalInput(null, "de")).toBe("");
    expect(formatDecimalInput("0", "de")).toBe("0");
    expect(formatDecimalInput("-0.25", "de")).toBe("-0,25");
  });
  it("keeps engine-hour inputs in HH:mm", async () => {
    await act(async () => { root = create(<Editor initial="01:30" hours />); });
    expect(input().props.value).toBe("01:30");
    const change = event("1,75");
    await act(async () => input().props.onChange(change));
    await act(async () => input().props.onBlur(change));
    expect(input().props.value).toBe("01:45");
  });
  it.each(["decimal", "ddm", "dms"] as const)("uses the same decimal separator for %s coordinate display and editing", format => {
    const text = coordinateToInput(47.512345, "lat", format, "de");
    expect(text).toContain(",");
    expect(text).not.toContain(".");
    expect(parseCoordinate(text)).toBeCloseTo(47.512345, format === "decimal" ? 4 : 5);
  });
});

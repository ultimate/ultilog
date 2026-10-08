import type { ComponentProps } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import { sampleLogSheets } from "../fixtures/logbook";
import { SharedLogSheetDetails, SharedTechnicalLog } from "../../app/components/logbook/SharedLogSheetDetails";
import { SharedSheetsCollection } from "../../app/components/logbook/SharedSheetsCollection";

vi.mock("next/link", () => ({ default: (props: ComponentProps<"a">) => <a {...props} /> }));
vi.mock("../../app/lib/i18n", async () => {
  const { t } = await import("../../app/lib/i18n/translations");
  return { useI18n: () => ({ locale: "en", t: (key: Parameters<typeof t>[1]) => t("en", key) }) };
});
vi.mock("../../app/components/logbook/OpenSeaMapView", () => ({ LogSheetsMapView: () => null }));
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function content(root: ReactTestRenderer) { return JSON.stringify(root.toJSON()); }

describe("shared log sheet presentation", () => {
  it("shows logline details and switches course columns and all coordinate formats", async () => {
    const sheet = { ...sampleLogSheets[0], lines: [{ ...sampleLogSheets[0].lines[0], latitude: 49.456, longitude: -2.534, weatherRemark: "Visibility note", sailNote: "Sail note", motorNote: "Motor note", engineHours: { main: 1.5 } }] };
    let root!: ReactTestRenderer;
    await act(async () => { root = create(<SharedLogSheetDetails sheet={sheet} engineLabels={{ main: "Main engine" }} />); });
    expect(content(root)).toContain("Visibility note");
    expect(content(root)).toContain("Sail note");
    expect(content(root)).toContain("Motor note");
    expect(content(root)).toContain("Main engine 1.5 h");
    expect(root.root.findAllByType("th")).toHaveLength(24);
    await act(async () => root.root.findAllByType("button")[1].props.onClick());
    expect(root.root.findAllByType("th")).toHaveLength(31);
    expect(content(root)).toContain("Compass course");
    expect(content(root)).toContain("Magnetic course");
    await act(async () => root.root.findAllByType("button")[0].props.onClick());
    expect(content(root)).toContain("49°");
    await act(async () => root.root.findAllByType("button")[0].props.onClick());
    expect(content(root)).toContain("21.60");
    await act(async () => root.root.findAllByType("button")[0].props.onClick());
    expect(content(root)).toContain("49.456");
    await act(async () => root.unmount());
  });

  it("shows technical check symbols and engine counter readings", async () => {
    let root!: ReactTestRenderer;
    await act(async () => { root = create(<SharedTechnicalLog sheet={{ ...sampleLogSheets[0], technicalChecks: [{ status: "⚠️", text: "Check coolant" }], engineHourCounters: { main: { start: 12, end: 14.5 } } }} engineLabels={{ main: "Main engine" }} />); });
    for (const value of ["⚠️", "Check coolant", "Main engine", "12 h", "14.5 h", "2.5 h"]) expect(content(root)).toContain(value);
    await act(async () => root.unmount());
  });

  it("orders shared sheets by start date, with undated sheets last, without changing the input", async () => {
    const entries = ["2026-10-08", "", "2025-03-01"].map((departed, index) => ({ boatName: "Boat", sheet: { ...sampleLogSheets[0], id: String(index), title: `Voyage ${index}`, route: { ...sampleLogSheets[0].route, departed } } }));
    let root!: ReactTestRenderer;
    await act(async () => { root = create(<SharedSheetsCollection ownerId="owner" entries={entries} initialView="list" embedded={false} showEmbedding={false} />); });
    const rows = root.root.findByType("tbody").findAllByType("tr");
    expect(rows.map(row => row.findAllByType("td")[2].findByType("a").children.join(""))).toEqual(["Voyage 2", "Voyage 0", "Voyage 1"]);
    expect(entries.map(entry => entry.sheet.id)).toEqual(["0", "1", "2"]);
    await act(async () => root.unmount());
  });
});

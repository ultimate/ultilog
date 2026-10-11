import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LogbookListPage } from "../../app/components/logbook/pages/LogbookListPage";
import { LogSheetsMapView } from "../../app/components/logbook/OpenSeaMapView";
import { ListPagination } from "../../app/components/logbook/SortableList";
import type { LogSheet } from "../../app/models/logbook";

vi.mock("../../app/lib/i18n", () => ({ useI18n: () => ({ t: (key: string) => key, locale: "en" }) }));
vi.mock("../../app/components/logbook/OpenSeaMapView", () => ({ LogSheetsMapView: () => null }));
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function sheet(id: string, departed: string, arrived = departed, boatId = "boat-1"): LogSheet {
  return { id, title: id, boatId, status: "Draft", route: { from: "A", to: "B", departed, arrived }, crew: [], technicalChecks: [], lines: [] };
}
const sheets = [
  sheet("before", "2026-05-01", "2026-05-09T23:59:00-02:00"),
  sheet("spanning", "2026-05-01", "2026-05-30"),
  sheet("start-boundary", "2026-05-10T00:00:00+14:00"),
  sheet("end-boundary", "2026-05-20T23:59:00-12:00"),
  sheet("after", "2026-05-21"),
  sheet("draft", "2026-05-15", ""),
  sheet("undated", "", ""),
  sheet("other-boat", "2026-05-15", "2026-05-15", "boat-2"),
];

describe("logsheet date filter", () => {
  let renderer: ReactTestRenderer;
  afterEach(async () => { await act(async () => renderer?.unmount()); });
  async function render(boatFilterId = "") {
    await act(async () => {
      renderer = create(<LogbookListPage
        scannerBoatId="" selectedScannerFiles={[]} isScanning={false} scannerError={null} isScannerPrivacyConfirmed={false}
        calculateSheetSummary={() => ({ motorMiles: 0, sailMiles: 0, totalMiles: 0, duration: "", motionDuration: "", motorHours: 0, motorHoursDuration: "", propulsionDuration: "" })}
        logbook={{ boats: [], crewMembers: [], sheets }} boatFilterId={boatFilterId} onBoatFilterChange={vi.fn()} navigate={vi.fn()}
        onScanFilesSelected={vi.fn()} onScannerUploadConfirmed={vi.fn()} onScannerUploadCanceled={vi.fn()} onScannerBoatChange={vi.fn()} onCreateBoatRequested={vi.fn()}
        setActiveSheetId={vi.fn()} setEditingSheetId={vi.fn()} setSheetForm={vi.fn()} setShowNewSheet={vi.fn()} createDefaultSheetForm={vi.fn()}
        defaultPageSize={5} onPrintSheet={vi.fn()} onPrintEmptySheet={vi.fn()} isDemo={false} onDemoFeatureBlocked={vi.fn()}
      />);
    });
  }
  async function changeDate(index: number, value: string) {
    await act(async () => renderer.root.findAllByProps({ type: "date" })[index].props.onChange({ currentTarget: { value } }));
  }
  function mapIds() {
    return renderer.root.findByType(LogSheetsMapView).props.sheets.map((item: LogSheet) => item.id);
  }
  function tableIds() {
    return renderer.root.findAllByProps({ className: "table-title-button" }).map((button) => button.findByProps({ className: "table-vessel" }).children.at(-1));
  }

  it("includes overlapping voyages and whole boundary dates in both the table and map, then resets", async () => {
    await render();
    expect(mapIds()).toHaveLength(8);
    await act(async () => renderer.root.findByType(ListPagination).props.list.setPage(2));
    await changeDate(0, "2026-05-10");
    await changeDate(1, "2026-05-20");
    const expected = ["spanning", "start-boundary", "end-boundary", "draft", "other-boat"];
    expect(mapIds()).toEqual(expected);
    expect(tableIds()).toEqual(expected);
    expect(renderer.root.findByType(ListPagination).props.list.page).toBe(1);
    await act(async () => renderer.root.findAllByType("button").find((button) => button.children.includes("logbooks.allTime"))!.props.onClick());
    expect(mapIds()).toHaveLength(8);
    expect(renderer.root.findAllByProps({ type: "date" }).map((input) => input.props.value)).toEqual(["", ""]);
  });

  it("supports either bound alone and combines dates with the vessel filter and search", async () => {
    await render("boat-1");
    await changeDate(1, "2026-05-10");
    expect(mapIds()).toEqual(["before", "spanning", "start-boundary"]);
    await changeDate(1, "");
    await changeDate(0, "2026-05-20");
    expect(mapIds()).toEqual(["spanning", "end-boundary", "after"]);
    await act(async () => renderer.root.findByProps({ type: "search" }).props.onChange({ target: { value: "after" } }));
    expect(tableIds()).toEqual(["after"]);
  });

  it("shows a validation message for reversed dates", async () => {
    await render();
    await changeDate(0, "2026-05-20");
    await changeDate(1, "2026-05-10");
    expect(renderer.root.findByProps({ role: "alert" }).children).toEqual(["logbooks.invalidDateRange"]);
    expect(mapIds()).toEqual([]);
    expect(renderer.root.findAllByProps({ type: "date" }).every((input) => input.props["aria-invalid"])).toBe(true);
  });
});

import { DateTimeFormatProvider } from "../../app/lib/DateTimeFormatProvider";
import { createElement, type ComponentProps } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LogbookListPage } from "../../app/components/logbook/pages/LogbookListPage";
import { LogSheetsMapView } from "../../app/components/logbook/OpenSeaMapView";
import { ListPagination } from "../../app/components/logbook/SortableList";
import type { LogSheet } from "../../app/models/logbook";

// React's test renderer does not support DOM portals; exercise dialog contents inline.
vi.mock("../../app/components/logbook/ModalLayer", () => ({
  ModalLayer: (props: ComponentProps<"div">) => createElement("div", props),
}));
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
  afterEach(async () => { await act(async () => renderer?.unmount()); vi.unstubAllGlobals(); });
  async function render(boatFilterId = "") {
    await act(async () => {
      renderer = create(<LogbookListPage
        scannerBoatId="" selectedScannerFiles={[]} isScanning={false} scannerError={null} isScannerPrivacyConfirmed={false}
        calculateSheetSummary={() => ({ motorMiles: 2, sailMiles: 3, totalMiles: 5, duration: "1h 30m", motionDuration: "1h 00m", durationMinutes: 90, motionDurationMinutes: 60, motorHours: 0.5, motorHoursDuration: "", propulsionDuration: "" })}
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

  it("expands the filtered overview map, closes it, and restores scrolling when opening a sheet", async () => {
    const body = { style: { overflow: "auto" } };
    vi.stubGlobal("document", { body });
    await render("boat-1");
    await changeDate(0, "2026-05-20");
    const fullMapButton = () => renderer.root.findAllByType("button").find((button) => button.children.includes("details.fullMap"))!;
    await act(async () => fullMapButton().props.onClick());
    expect(body.style.overflow).toBe("hidden");
    const dialog = renderer.root.findByProps({ role: "dialog" });
    expect(dialog.props["aria-modal"]).toBe("true");
    const expandedMap = dialog.findByType(LogSheetsMapView);
    expect(expandedMap.props.className).toBe("open-seamap-expanded");
    expect(expandedMap.props.sheets.map((item: LogSheet) => item.id)).toEqual(["spanning", "end-boundary", "after"]);
    expect(expandedMap.props.showRouteTargets).toBe(false);
    await act(async () => dialog.findByType("button").props.onClick());
    expect(renderer.root.findAllByProps({ role: "dialog" })).toHaveLength(0);
    expect(body.style.overflow).toBe("auto");
    await act(async () => fullMapButton().props.onClick());
    await act(async () => renderer.root.findByProps({ role: "dialog" }).findByType(LogSheetsMapView).props.onSheetClick(sheets[1]));
    expect(renderer.root.findAllByProps({ role: "dialog" })).toHaveLength(0);
    expect(body.style.overflow).toBe("auto");
    expect(renderer.root.findByType(LogbookListPage).props.navigate).toHaveBeenCalledWith("details", "spanning");
  });

  it("totals only the filtered current page and highlights hovered routes", async () => {
    await render();
    const totalCells = () => renderer.root.findByType("tfoot").findAllByType("td").map((cell) => cell.children.join(""));
    expect(totalCells()).toEqual(["15 nm", "10 nm", "25 nm", "7h 30m", "5h 00m", "02:30", ""]);
    await act(async () => renderer.root.findByType(ListPagination).props.list.setPage(2));
    expect(totalCells()).toEqual(["9 nm", "6 nm", "15 nm", "4h 30m", "3h 00m", "01:30", ""]);
    await act(async () => renderer.root.findByProps({ type: "search" }).props.onChange({ target: { value: "after" } }));
    expect(totalCells()).toEqual(["3 nm", "2 nm", "5 nm", "1h 30m", "1h 00m", "00:30", ""]);
    const row = renderer.root.findByProps({ className: "logbook-sheet-title" });
    await act(async () => row.props.onMouseEnter());
    expect(renderer.root.findByType(LogSheetsMapView).props.highlightedRouteId).toBe("after");
    await act(async () => row.props.onMouseLeave());
    expect(renderer.root.findByType(LogSheetsMapView).props.highlightedRouteId).toBeNull();
    await act(async () => renderer.root.findByProps({ type: "checkbox" }).props.onChange({ currentTarget: { checked: false } }));
    expect(renderer.root.findByType(LogSheetsMapView).props.showEndpointMarkers).toBe(false);
    const links = renderer.root.findAllByType("a");
    expect(links).toHaveLength(2); // Title and compact Open action.
    for (const link of links) {
      expect(link.props.href).toMatch(/details\/after$/);
      for (const click of [{ button: 1 }, { button: 0, ctrlKey: true }, { button: 0, metaKey: true }]) {
        const preventDefault = vi.fn();
        await act(async () => link.props.onClick({ ...click, preventDefault }));
        expect(preventDefault).not.toHaveBeenCalled();
      }
      const preventDefault = vi.fn();
      await act(async () => link.props.onClick({ button: 0, preventDefault }));
      expect(preventDefault).toHaveBeenCalled();
      expect(renderer.root.findByType(LogbookListPage).props.navigate).toHaveBeenCalledWith("details", "after");
    }
  });

  it("requires explicit privacy consent before uploading selected photos", async () => {
    await render();
    const upload = vi.fn();
    await act(async () => renderer.update(<LogbookListPage {...(renderer.root.findByType(LogbookListPage).props as ComponentProps<typeof LogbookListPage>)}
      scannerBoatId="boat-1" selectedScannerFiles={[{} as File]} onScannerUploadConfirmed={upload} />));
    const confirm = () => renderer.root.findAllByType("button").find((button) => button.children.includes("logbooks.continueAndUpload"))!;
    expect(confirm().props.disabled).toBe(true);
    await act(async () => confirm().props.onClick());
    expect(upload).not.toHaveBeenCalled();
    await act(async () => renderer.root.findByProps({ className: "scanner-privacy-confirmation" }).findByType("input").props.onChange({ currentTarget: { checked: true } }));
    expect(confirm().props.disabled).toBe(false);
    await act(async () => confirm().props.onClick());
    expect(upload).toHaveBeenCalledWith([{}], "boat-1");
  });

  it("shows configured calendar dates only and treats midnight end as the previous day", async () => {
    await render();
    const props = renderer.root.findByType(LogbookListPage).props as ComponentProps<typeof LogbookListPage>;
    await act(async () => renderer.update(
      <DateTimeFormatProvider dateFormat="MM/dd/yyyy" timeFormat="HH:mm">
        <LogbookListPage {...props} logbook={{ ...props.logbook, sheets: [sheet("midnight", "2026-12-31T08:30:00+14:00", "2027-01-01T00:00:00+14:00")] }} />
      </DateTimeFormatProvider>,
    ));
    const detailsRow = renderer.root.findByType("tbody").findAllByType("tr")[1];
    expect(detailsRow.findAllByType("td").slice(0, 2).map((cell) => cell.children.join(""))).toEqual(["12/31/2026", "12/31/2026"]);
  });

  it("offers camera capture and existing photos from the single scan action", async () => {
    await render();
    const props = renderer.root.findByType(LogbookListPage).props as ComponentProps<typeof LogbookListPage>;
    await act(async () => renderer.update(<LogbookListPage {...props} logbook={{ ...props.logbook, boats: [{ id: "boat-1", name: "Boat" } as NonNullable<typeof props.activeBoat>] }} />));
    const button = (key: string) => renderer.root.findAllByType("button").find((item) => item.children.includes(key))!;
    await act(async () => button("logbooks.scanImport").props.onClick());
    const dialog = renderer.root.findByProps({ role: "dialog" });
    expect(dialog.findAllByType("button").map((item) => item.children.join(""))).toEqual(["logbooks.scanWithCamera", "logbooks.importPhotos", "common.cancel"]);
    const inputs = renderer.root.findAllByProps({ type: "file" });
    expect(inputs.find((input) => input.props.capture === "environment")?.props.multiple).toBeUndefined();
    expect(inputs.find((input) => input.props.multiple)?.props.capture).toBeUndefined();
    await act(async () => button("common.cancel").props.onClick());
    expect(renderer.root.findAllByProps({ role: "dialog" })).toHaveLength(0);
  });

  it("displays legacy voyage dates in the configured format and brackets the route", async () => {
    await render();
    const props = renderer.root.findByType(LogbookListPage).props as ComponentProps<typeof LogbookListPage>;
    await act(async () => renderer.update(
      <DateTimeFormatProvider dateFormat="dd.MM.yyyy" timeFormat="HH:mm">
        <LogbookListPage {...props} logbook={{ ...props.logbook, sheets: [sheet("legacy", "14 May 2026, 07:35", "15 May 2026, 00:00")] }} />
      </DateTimeFormatProvider>,
    ));
    const detailsRow = renderer.root.findByType("tbody").findAllByType("tr")[1];
    expect(detailsRow.findAllByType("td").slice(0, 2).map((cell) => cell.children.join(""))).toEqual(["14.05.2026", "14.05.2026"]);
    expect(renderer.root.findByProps({ className: "logbook-sheet-route" }).children.join("")).toBe("(A → B)");
  });

  it("formats calendar selections and parses typed filters using the date preference", async () => {
    await render();
    const props = renderer.root.findByType(LogbookListPage).props as ComponentProps<typeof LogbookListPage>;
    await act(async () => renderer.update(
      <DateTimeFormatProvider dateFormat="MM/dd/yyyy" timeFormat="HH:mm"><LogbookListPage {...props} /></DateTimeFormatProvider>,
    ));
    await changeDate(0, "2026-05-20");
    const from = () => renderer.root.findAllByProps({ type: "text" }).find((input) => input.props["aria-label"] === "logbooks.fromDate")!;
    expect(from().props.value).toBe("05/20/2026");
    await act(async () => from().props.onChange({ currentTarget: { value: "05/21/2026" } }));
    expect(mapIds()).toEqual(["spanning", "after"]);
    expect(renderer.root.findAllByProps({ type: "date" })[0].props.value).toBe("2026-05-21");
    await act(async () => from().props.onChange({ currentTarget: { value: "02/31/2026" } }));
    expect(from().props["aria-invalid"]).toBe(true);
    await act(async () => from().props.onChange({ currentTarget: { value: "" } }));
    expect(mapIds()).toHaveLength(8);
  });

  it("captures the complete sorted navigation sequence and restores overview pagination", async () => {
    await render();
    const props = renderer.root.findByType(LogbookListPage).props as ComponentProps<typeof LogbookListPage>;
    const onOpenSequence = vi.fn();
    await act(async () => renderer.update(<LogbookListPage {...props} onOpenSequence={onOpenSequence} />));
    await act(async () => renderer.root.findByType(ListPagination).props.list.setSortKey("entry"));
    await act(async () => renderer.root.findByType(ListPagination).props.list.setPage(2));
    await act(async () => renderer.root.findByType(LogSheetsMapView).props.onSheetClick(sheets[1]));
    const [ids, state] = onOpenSequence.mock.calls[0];
    expect(ids).toEqual(["after", "before", "draft", "end-boundary", "other-boat", "spanning", "start-boundary", "undated"]);
    expect(state).toMatchObject({ page: 2, pageSize: 5, sort: { key: "entry", direction: "ascending" } });
    await act(async () => renderer.update(<LogbookListPage {...props} key="restored" overviewState={state} />));
    expect(renderer.root.findByType(ListPagination).props.list.page).toBe(2);
    expect(tableIds()).toEqual(["spanning", "start-boundary", "undated"]);
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

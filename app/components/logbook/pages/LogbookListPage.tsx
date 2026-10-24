import { formatEngineHours } from "../../../lib/log-input";
import { DateFilterInput } from "../DateFilterInput";
import { ModalLayer } from "../ModalLayer";
import { Fragment } from "react";
import { modulePath } from "../persistence";
import { formatLogSheetDuration } from "../../../domain/logbook/sheet-metrics";
import { EntityImage } from "../EntityImage";
import { useI18n } from "../../../lib/i18n";
import { useDateTimeFormat } from "../../../lib/DateTimeFormatProvider";
import { formatMiles } from "../../../lib/format-number";
import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type {
  Boat,
  LogSheet,
  PersistedLogbook,
  SheetForm,
} from "../../../models/logbook";
import { sheetListDate } from "../date-utils";
import { sheetToForm } from "../forms";
import { LogSheetsMapView } from "../OpenSeaMapView";
import { ListPagination, ListSearch, SortableColumnHeader, useSortableList } from "../SortableList";

export type SheetOverviewState = { fromDate: string; toDate: string; query: string; sort: { key: string; direction: "ascending" | "descending" }; page: number; pageSize: number };

type Navigate = (
  module: "details" | "logbooks",
  itemId?: string | number,
) => void;
type SheetSummary = { motorMiles: number; sailMiles: number; totalMiles: number; duration: string; motionDuration: string; durationMinutes: number | null; motionDurationMinutes: number; motorHours: number; motorHoursDuration: string; propulsionDuration: string };
type SheetListRow = { sheet: LogSheet; boat?: Boat; summary: SheetSummary };

export function LogbookListPage({
  overviewState,
  onOpenSequence,
  activeBoat,
  scannerBoatId,
  selectedScannerFiles,
  isScanning,
  isScannerPrivacyConfirmed,
  calculateSheetSummary,
  logbook,
  boatFilterId,
  onBoatFilterChange,
  navigate,
  onScanFilesSelected,
  onScannerUploadConfirmed,
  onScannerUploadCanceled,
  onScannerBoatChange,
  onCreateBoatRequested,
  setActiveSheetId,
  setEditingSheetId,
  setSheetForm,
  setShowNewSheet,
  createDefaultSheetForm,
  defaultPageSize,
  onPrintSheet,
  onPrintEmptySheet,
  isDemo,
  onDemoFeatureBlocked,
}: {
  overviewState?: SheetOverviewState;
  onOpenSequence?: (ids: string[], state: SheetOverviewState) => void;
  activeBoat?: Boat;
  scannerBoatId: string;
  selectedScannerFiles: File[];
  isScanning: boolean;
  scannerError: string | null;
  isScannerPrivacyConfirmed: boolean;
  calculateSheetSummary: (sheet: LogSheet) => SheetSummary;
  logbook: PersistedLogbook;
  boatFilterId: string;
  onBoatFilterChange: (boatId: string) => void;
  navigate: Navigate;
  onScanFilesSelected: (files: FileList | File[], boatId: string) => void;
  onScannerUploadConfirmed: (files: File[], boatId: string) => void;
  onScannerUploadCanceled: () => void;
  onScannerBoatChange: (boatId: string) => void;
  onCreateBoatRequested: () => void;
  setActiveSheetId: Dispatch<SetStateAction<string>>;
  setEditingSheetId: Dispatch<SetStateAction<string | null>>;
  setSheetForm: Dispatch<SetStateAction<SheetForm>>;
  setShowNewSheet: Dispatch<SetStateAction<boolean>>;
  createDefaultSheetForm: () => SheetForm;
  defaultPageSize: number;
  onPrintSheet: (sheetId: string) => void;
  onPrintEmptySheet: () => void;
  isDemo: boolean;
  onDemoFeatureBlocked: (feature: "scanner") => void;
}) {
  const { t } = useI18n();
  const { formatDate } = useDateTimeFormat();
  const [showScanSource, setShowScanSource] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const availableBoats = useMemo(() => logbook.boats.filter((boat) => !boat.archived), [logbook.boats]);
  const hasBoats = availableBoats.length > 0;
  const hasMultipleBoats = availableBoats.length > 1;
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [showEndpointMarkers, setShowEndpointMarkers] = useState(true);
  const [highlightedRouteId, setHighlightedRouteId] = useState<string | null>(null);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [fromDate, setFromDate] = useState(overviewState?.fromDate ?? "");
  const [toDate, setToDate] = useState(overviewState?.toDate ?? "");
  const invalidDateRange = Boolean(fromDate && toDate && fromDate > toDate);
  const filteredSheets = useMemo(
    () => logbook.sheets.filter((sheet) => {
      if (boatFilterId && sheet.boatId !== boatFilterId) return false;
      if (!fromDate && !toDate) return true;
      if (invalidDateRange) return false;
      // Compare voyage calendar dates without shifting their stored timezone.
      const departed = sheet.route.departed.slice(0, 10);
      const arrived = sheet.route.arrived.slice(0, 10) || departed;
      if (!departed) return false;
      return (!fromDate || arrived >= fromDate) && (!toDate || departed <= toDate);
    }),
    [boatFilterId, fromDate, toDate, invalidDateRange, logbook.sheets],
  );
  const rows = useMemo(() => filteredSheets.map((sheet) => ({
    sheet,
    boat: logbook.boats.find((candidate) => candidate.id === sheet.boatId),
    summary: calculateSheetSummary(sheet),
  })), [calculateSheetSummary, filteredSheets, logbook.boats]);
  const columns = useMemo(() => [
    { key: "startDate", value: (row: SheetListRow) => row.sheet.route.departed },
    { key: "endDate", value: (row: SheetListRow) => row.sheet.route.arrived },
    { key: "entry", value: (row: SheetListRow) => row.sheet.title },
    { key: "vessel", value: (row: SheetListRow) => row.boat?.name },
    { key: "route", value: (row: SheetListRow) => [row.sheet.route.from, row.sheet.route.to] },
    { key: "sailMiles", value: (row: SheetListRow) => row.summary.sailMiles },
    { key: "motorMiles", value: (row: SheetListRow) => row.summary.motorMiles },
    { key: "totalMiles", value: (row: SheetListRow) => row.summary.totalMiles },
    { key: "duration", value: (row: SheetListRow) => row.summary.duration },
    { key: "motionDuration", value: (row: SheetListRow) => row.summary.motionDuration },
    { key: "motorHours", value: (row: SheetListRow) => row.summary.motorHours },
  ], []);
  const list = useSortableList(rows, columns, defaultPageSize, "", overviewState);
  const totals = list.pageItems.reduce((sum, { summary }) => ({
    sailMiles: sum.sailMiles + summary.sailMiles,
    motorMiles: sum.motorMiles + summary.motorMiles,
    totalMiles: sum.totalMiles + summary.totalMiles,
    durationMinutes: sum.durationMinutes + (summary.durationMinutes ?? 0),
    motionDurationMinutes: sum.motionDurationMinutes + (summary.motionDurationMinutes ?? 0),
    motorHours: sum.motorHours + summary.motorHours,
  }), { sailMiles: 0, motorMiles: 0, totalMiles: 0, durationMinutes: 0, motionDurationMinutes: 0, motorHours: 0 });
  const markerLegend = <div className="map-marker-legend">
    <span>▶ {t("map.start")}</span><span>🏁 {t("map.end")}</span>
    <label><input type="checkbox" checked={showEndpointMarkers} onChange={(event) => setShowEndpointMarkers(event.currentTarget.checked)} /> {t("map.showEndpoints")}</label>
  </div>;
  const header = (key: string, label: string) => <SortableColumnHeader columnKey={key} activeKey={list.sort.key} direction={list.sort.direction} onSort={list.setSortKey}>{label}</SortableColumnHeader>;

  useEffect(() => {
    if (!isMapExpanded) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMapExpanded]);

  function handleScannerFilesSelected(files: FileList | null) {
    if (!files?.length) return;
    setPrivacyAccepted(false);
    onScanFilesSelected(files, scannerBoatId);
  }

  function confirmScannerUpload() {
    if (!selectedScannerFiles.length || !privacyAccepted || !scannerBoatId) return;
    onScannerUploadConfirmed(selectedScannerFiles, scannerBoatId);
  }

  function openSheet(sheet: LogSheet) {
    onOpenSequence?.(list.processedItems.map(row => row.sheet.id), { fromDate, toDate, query: list.query, sort: list.sort, page: list.page, pageSize: list.pageSize });
    setIsMapExpanded(false);
    setActiveSheetId(sheet.id);
    setSheetForm(sheetToForm(sheet));
    navigate("details", sheet.id);
  }

  return (
    <section className="logbook-page module-panel" aria-label={t("logbooks.aria")} aria-busy={isScanning}>
      <div className="page-heading">
        <div>
          <h1>{t("logbooks.title")}</h1>
          <p>{t("logbooks.subtitle")}</p>
        </div>
        <div className="page-heading-actions">
          <button
            type="button"
            className="primary-action"
            onClick={() => {
              setEditingSheetId(null);
              if (!activeBoat) return;
              setSheetForm(createDefaultSheetForm());
              setShowNewSheet(true);
              navigate("details");
            }}
          >
            {t("logbooks.newSheet")}
          </button>
          {hasBoats && <button type="button" className="secondary-action" disabled={isScanning}
            onClick={() => isDemo ? onDemoFeatureBlocked("scanner") : setShowScanSource(true)}>
            {isScanning ? t("logbooks.uploadingScan") : t("logbooks.scanImport")}
          </button>}
          <button
            type="button"
            className="secondary-action"
            onClick={onPrintEmptySheet}
          >
            {t("logbooks.printEmptySheet")}
          </button>
        </div>
      </div>
      {showScanSource && (
        <ModalLayer className="scanner-privacy-modal" role="dialog" aria-modal="true" aria-labelledby="scanner-source-title">
          <div className="scanner-privacy-panel">
            <h2 id="scanner-source-title">{t("logbooks.scanImport")}</h2>
            <button type="button" className="secondary-action" onClick={() => { setShowScanSource(false); cameraInputRef.current?.click(); }}>
              {t("logbooks.scanWithCamera")}
            </button>
            <button type="button" className="secondary-action" onClick={() => { setShowScanSource(false); importInputRef.current?.click(); }}>
              {t("logbooks.importPhotos")}
            </button>
            <button type="button" className="ghost-button" onClick={() => setShowScanSource(false)}>{t("common.cancel")}</button>
          </div>
        </ModalLayer>
      )}
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" hidden
        onChange={(event) => { handleScannerFilesSelected(event.currentTarget.files); event.currentTarget.value = ""; }} />
      <input ref={importInputRef} type="file" accept="image/*" multiple hidden
        onChange={(event) => { handleScannerFilesSelected(event.currentTarget.files); event.currentTarget.value = ""; }} />
      {!hasBoats && (
        <div className="logbook-scanner-empty" role="status">
          <p>{t("logbooks.createBoatBeforeScan")}</p>
          <button
            type="button"
            className="secondary-action"
            onClick={onCreateBoatRequested}
          >
            {t("boats.create")}
          </button>
        </div>
      )}

      {isScanning && (
        <div className="scanner-upload-status" role="status" aria-live="polite">
          <span className="scanner-upload-spinner" aria-hidden="true" />
          <div className="scanner-upload-copy">
            <strong>{t("logbooks.processingScan")}</strong>
            <p>{t("logbooks.processingScanHelp")}</p>
          </div>
          <div
            className="scanner-upload-progress"
            role="progressbar"
            aria-label={t("logbooks.processingScan")}
          >
            <span />
          </div>
        </div>
      )}

      {selectedScannerFiles.length > 0 && !isScannerPrivacyConfirmed && (
        <ModalLayer
          className="scanner-privacy-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="scanner-privacy-title"
        >
          <div className="scanner-privacy-panel">
            <div className="scanner-privacy-heading">
              <h2 id="scanner-privacy-title">
                {t("logbooks.scannerSettingsTitle")}
              </h2>
              <p>{t("logbooks.scannerPrivacyIntro")}</p>
            </div>
            {hasMultipleBoats && <label className="scanner-boat-selector">
              <span>{t("logbooks.scannerBoat")}</span>
              <select value={scannerBoatId} onChange={(event) => onScannerBoatChange(event.currentTarget.value)}>
                {availableBoats.map((boat) => <option key={boat.id} value={boat.id}>{boat.name}</option>)}
              </select>
            </label>}
            <h3>{t("logbooks.scannerPrivacyTitle")}</h3>
            <ul className="scanner-privacy-list">
              <li>{t("logbooks.scannerPrivacyPersonalInfo")}</li>
              <li>{t("logbooks.scannerPrivacyCloudProvider")}</li>
              <li>{t("logbooks.scannerPrivacyNoPermanentStorage")}</li>
            </ul>
            <label className="scanner-privacy-confirmation"><input type="checkbox" checked={privacyAccepted} onChange={(event) => setPrivacyAccepted(event.currentTarget.checked)} /> {t("logbooks.scannerPrivacyAccept")}</label>
            <section><h3>{t("logbooks.scannerDraftTitle")}</h3>
              <p>{t("logbooks.scannerPrivacyDraftSaved")} {t("logbooks.scannerPrivacyVerifyBeforeLock")}</p>
            </section>
            <div className="scanner-privacy-actions">
              <button
                type="button"
                className="ghost-button"
                disabled={isScanning}
                onClick={onScannerUploadCanceled}
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                className="primary-action"
                disabled={isScanning || !privacyAccepted || !scannerBoatId}
                onClick={confirmScannerUpload}
              >
                {t("logbooks.continueAndUpload")}
              </button>
            </div>
          </div>
        </ModalLayer>
      )}
      <div className="logbook-toolbar">
        <ListSearch value={list.query} onChange={list.setQuery} label={t("logbooks.search")} />
        <select aria-label={t("logbooks.vesselFilter")} value={boatFilterId} onChange={(event) => onBoatFilterChange(event.currentTarget.value)}>
          <option value="">{t("logbooks.allVessels")}</option>
          {logbook.boats.map((boat) => <option key={boat.id} value={boat.id}>{boat.name}</option>)}
        </select>
        <div className="logbook-date-filter" role="group" aria-label={t("logbooks.timeFilter")}>
          <DateFilterInput label={t("logbooks.fromDate")} value={fromDate} max={toDate || undefined} invalid={invalidDateRange} describedBy={invalidDateRange ? "logbook-date-range-error" : undefined} onChange={(value) => { setFromDate(value); list.setPage(1); }} />
          <DateFilterInput label={t("logbooks.toDate")} value={toDate} min={fromDate || undefined} invalid={invalidDateRange} describedBy={invalidDateRange ? "logbook-date-range-error" : undefined} onChange={(value) => { setToDate(value); list.setPage(1); }} />
          <button type="button" className="ghost-button" disabled={!fromDate && !toDate} onClick={() => { setFromDate(""); setToDate(""); list.setPage(1); }}>
            {t("logbooks.allTime")}
          </button>
        </div>
      </div>
      {invalidDateRange && <p id="logbook-date-range-error" className="save-error" role="alert">{t("logbooks.invalidDateRange")}</p>}
      <div className="logbook-overview-layout">
        <article className="table-card logbook-list-card">
          <div className="logbook-list-heading">
            <h3>{t("logbooks.allSheets")}</h3>
          </div>
          <div className="table-scroll">
            <table className="logbook-table">
              <thead>
                <tr>
                  {header("entry", t("logbooks.entry"))}
                  {header("startDate", t("logbooks.startDate"))}
                  {header("endDate", t("logbooks.endDate"))}
                  {header("vessel", t("logbooks.vessel"))}
                  {header("sailMiles", t("compliance.sailMiles"))}
                  {header("motorMiles", t("compliance.motorMiles"))}
                  {header("totalMiles", t("logbooks.totalMiles"))}
                  {header("duration", t("dashboard.overallDuration"))}
                  {header("motionDuration", t("dashboard.motionDuration"))}
                  {header("motorHours", t("dashboard.totalEngineHours"))}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {list.pageItems.map(({ sheet, boat, summary: sheetSummary }) => {
                  return (
                    <Fragment key={sheet.id}>
                    <tr className="logbook-sheet-title" onMouseEnter={() => setHighlightedRouteId(sheet.id)} onMouseLeave={() => setHighlightedRouteId(null)}>
                      <td rowSpan={2} className="logbook-sheet-image-cell">
                        <div className="logbook-sheet-images">
                          <EntityImage image={sheet.image} entityType="sheet" alt="" variant="thumb" className="logbook-sheet-thumbnail" />
                          {boat?.image?.data && <EntityImage image={boat.image} entityType="boat" alt={boat.name} variant="thumb" className="logbook-boat-badge" />}
                        </div>
                      </td>
                      <td colSpan={9}><a className="table-title-button" href={modulePath("details", sheet.id)}
                        onClick={(event) => { if (event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); openSheet(sheet); } }}><span className="table-vessel">{sheet.title}</span></a>
                        <span className="logbook-sheet-route">({sheet.route.from} → {sheet.route.to})</span>
                      </td>
                      <td rowSpan={2} className="logbook-sheet-actions-cell">
                        <div className="table-row-actions">
                          <a className="edit-chip" href={modulePath("details", sheet.id)} aria-label={t("common.open")} title={t("common.open")}
                            onClick={(event) => { if (event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); openSheet(sheet); } }}>
                            <span aria-hidden="true">📂</span>
                          </a>
                          <button
                            className="edit-chip"
                            aria-label={t("logbooks.printSheet")} title={t("logbooks.printSheet")}
                            onClick={() => onPrintSheet(sheet.id)}
                            type="button"
                          >
                            <span aria-hidden="true">🖨️</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                    <tr onMouseEnter={() => setHighlightedRouteId(sheet.id)} onMouseLeave={() => setHighlightedRouteId(null)} onFocus={() => setHighlightedRouteId(sheet.id)} onBlur={() => setHighlightedRouteId(null)}>
                      <td className="logbook-date-cell">{formatDate(sheetListDate(sheet.route.departed))}</td>
                      <td className="logbook-date-cell">{formatDate(sheetListDate(sheet.route.arrived, true))}</td>
                      <td className="logbook-boat-name-cell">{boat?.name}</td>
                      <td className="logbook-metric-cell">{formatMiles(sheetSummary.sailMiles)} nm</td>
                      <td className="logbook-metric-cell">{formatMiles(sheetSummary.motorMiles)} nm</td>
                      <td className="logbook-metric-cell">{formatMiles(sheetSummary.totalMiles)} nm</td>
                      <td className="logbook-metric-cell">{sheetSummary.duration}</td>
                      <td className="logbook-metric-cell">{sheetSummary.motionDuration}</td>
                      <td className="logbook-metric-cell">{sheetSummary.motorHoursDuration}</td>

                    </tr>
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot><tr>
                <th colSpan={4} scope="row">{t("logbooks.pageTotals")}</th>
                <td className="logbook-metric-cell">{formatMiles(totals.sailMiles)} nm</td><td className="logbook-metric-cell">{formatMiles(totals.motorMiles)} nm</td><td className="logbook-metric-cell">{formatMiles(totals.totalMiles)} nm</td>
                <td className="logbook-metric-cell">{formatLogSheetDuration(totals.durationMinutes)}</td><td className="logbook-metric-cell">{formatLogSheetDuration(totals.motionDurationMinutes)}</td>
                <td className="logbook-metric-cell">{formatEngineHours(totals.motorHours)}</td><td />
              </tr></tfoot>
            </table>
          </div>
          <ListPagination list={list} />
        </article>
        <article className="map-card logbook-overview-map-card">
          <div className="logbook-overview-map-heading">
            <p>{t("logbooks.mapHelp")}</p>
            <button className="edit-chip" type="button" onClick={() => setIsMapExpanded(true)}>
              {t("details.fullMap")}
            </button>
          </div>
          <LogSheetsMapView
            sheets={filteredSheets}
            onSheetClick={openSheet}
            ariaLabel={t("logbooks.mapAria")}
            showRouteTargets={false}
            showEndpointMarkers={showEndpointMarkers}
            highlightedRouteId={highlightedRouteId}
          />
          {markerLegend}
        </article>
      </div>
      {isMapExpanded && (
        <ModalLayer className="logbook-map-modal" role="dialog" aria-modal="true" aria-labelledby="logbook-overview-map-modal-title">
          <div className="logbook-map-modal-panel">
            <div className="logbook-map-modal-heading">
              <h2 id="logbook-overview-map-modal-title">{t("logbooks.overviewMap")}</h2>
              <button className="edit-chip" type="button" onClick={() => setIsMapExpanded(false)}>
                {t("details.closeMap")}
              </button>
            </div>
            <LogSheetsMapView
              className="open-seamap-expanded"
              sheets={filteredSheets}
              onSheetClick={openSheet}
              ariaLabel={t("logbooks.mapAria")}
              showRouteTargets={false}
            showEndpointMarkers={showEndpointMarkers}
            highlightedRouteId={highlightedRouteId}
            />
            {markerLegend}
          </div>
        </ModalLayer>
      )}
    </section>
  );
}

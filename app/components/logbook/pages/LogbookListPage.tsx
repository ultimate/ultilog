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
import { sheetToForm } from "../forms";
import { LogSheetsMapView } from "../OpenSeaMapView";
import { ListPagination, ListSearch, SortableColumnHeader, useSortableList } from "../SortableList";

type Navigate = (
  module: "details" | "logbooks",
  itemId?: string | number,
) => void;
type SheetSummary = { motorMiles: number; sailMiles: number; totalMiles: number; duration: string; motionDuration: string; motorHours: number; motorHoursDuration: string; propulsionDuration: string };
type SheetListRow = { sheet: LogSheet; boat?: Boat; summary: SheetSummary };

export function LogbookListPage({
  activeBoat,
  scannerBoatId,
  selectedScannerFiles,
  isScanning,
  scannerError,
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
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const availableBoats = useMemo(() => logbook.boats.filter((boat) => !boat.archived), [logbook.boats]);
  const hasBoats = availableBoats.length > 0;
  const hasMultipleBoats = availableBoats.length > 1;
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
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
  const list = useSortableList(rows, columns, defaultPageSize);
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
    onScanFilesSelected(files, scannerBoatId);
  }

  function confirmScannerUpload() {
    if (!selectedScannerFiles.length) return;
    onScannerUploadConfirmed(selectedScannerFiles, scannerBoatId);
  }

  function openSheet(sheet: LogSheet) {
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
            className="secondary-action"
            onClick={onPrintEmptySheet}
          >
            {t("logbooks.printEmptySheet")}
          </button>
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
        </div>
      </div>
      {hasBoats ? (
        <div className="logbook-scanner-actions" aria-label={t("logbooks.scannerActions")}>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(event) => {
              handleScannerFilesSelected(event.currentTarget.files);
              event.currentTarget.value = "";
            }}
          />
          {hasMultipleBoats && (
            <label className="scanner-boat-selector">
              <span>{t("logbooks.scannerBoat")}</span>
              <select
                value={scannerBoatId}
                onChange={(event) =>
                  onScannerBoatChange(event.currentTarget.value)
                }
                aria-label={t("logbooks.scannerBoat")}
              >
                {availableBoats.map((boat) => (
                  <option key={boat.id} value={boat.id}>
                    {boat.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            type="button"
            className="secondary-action"
            disabled={isScanning}
            onClick={() => isDemo ? onDemoFeatureBlocked("scanner") : cameraInputRef.current?.click()}
          >
            {t("logbooks.scanWithCamera")}
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(event) => {
              handleScannerFilesSelected(event.currentTarget.files);
              event.currentTarget.value = "";
            }}
          />
          <button
            type="button"
            className="secondary-action"
            disabled={isScanning}
            onClick={() => isDemo ? onDemoFeatureBlocked("scanner") : importInputRef.current?.click()}
          >
            {isScanning
              ? t("logbooks.uploadingScan")
              : t("logbooks.importPhotos")}
          </button>
        </div>
      ) : (
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

      {scannerError && (
        <p className="save-error" role="alert">
          {scannerError}
        </p>
      )}

      {selectedScannerFiles.length > 0 && !isScannerPrivacyConfirmed && (
        <div
          className="scanner-privacy-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="scanner-privacy-title"
        >
          <div className="scanner-privacy-panel">
            <div className="scanner-privacy-heading">
              <h2 id="scanner-privacy-title">
                {t("logbooks.scannerPrivacyTitle")}
              </h2>
              <p>{t("logbooks.scannerPrivacyIntro")}</p>
            </div>
            <ul className="scanner-privacy-list">
              <li>{t("logbooks.scannerPrivacyPersonalInfo")}</li>
              <li>{t("logbooks.scannerPrivacyCloudProvider")}</li>
              <li>{t("logbooks.scannerPrivacyNoPermanentStorage")}</li>
              <li>{t("logbooks.scannerPrivacyDraftSaved")}</li>
              <li>{t("logbooks.scannerPrivacyVerifyBeforeLock")}</li>
            </ul>
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
                disabled={isScanning}
                onClick={confirmScannerUpload}
              >
                {t("logbooks.continueAndUpload")}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="logbook-toolbar">
        <ListSearch value={list.query} onChange={list.setQuery} label={t("logbooks.search")} />
        <select aria-label={t("logbooks.vesselFilter")} value={boatFilterId} onChange={(event) => onBoatFilterChange(event.currentTarget.value)}>
          <option value="">{t("logbooks.allVessels")}</option>
          {logbook.boats.map((boat) => <option key={boat.id} value={boat.id}>{boat.name}</option>)}
        </select>
        <div className="logbook-date-filter" role="group" aria-label={t("logbooks.timeFilter")}>
          <label>
            <span>{t("logbooks.fromDate")}</span>
            <input type="date" value={fromDate} max={toDate || undefined} aria-invalid={invalidDateRange} aria-describedby={invalidDateRange ? "logbook-date-range-error" : undefined} onChange={(event) => { setFromDate(event.currentTarget.value); list.setPage(1); }} />
          </label>
          <label>
            <span>{t("logbooks.toDate")}</span>
            <input type="date" value={toDate} min={fromDate || undefined} aria-invalid={invalidDateRange} aria-describedby={invalidDateRange ? "logbook-date-range-error" : undefined} onChange={(event) => { setToDate(event.currentTarget.value); list.setPage(1); }} />
          </label>
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
                  {header("startDate", t("logbooks.startDate"))}
                  {header("endDate", t("logbooks.endDate"))}
                  {header("entry", t("logbooks.entry"))}
                  {header("vessel", t("logbooks.vessel"))}
                  {header("route", t("logbooks.fromTo"))}
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
                    <tr key={sheet.id}>
                      <td>{formatDate(sheet.route.departed)}</td>
                      <td>{formatDate(sheet.route.arrived)}</td>
                      <td>
                        <button
                          className="table-title-button"
                          onClick={() => {
                            openSheet(sheet);
                          }}
                          type="button"
                        >
                          <span className="table-vessel">
                            <span aria-hidden="true">
                              <EntityImage
                                image={sheet.image}
                                entityType="sheet"
                                alt=""
                                variant="thumb"
                              />
                            </span>
                            {sheet.title}
                          </span>
                        </button>
                      </td>
                      <td>
                        <span className="table-vessel">
                          <EntityImage
                            image={boat?.image}
                            entityType="boat"
                            alt={boat ? `${boat.name} thumbnail` : t("common.boat")}
                            variant="thumb"
                          />
                          {boat?.name}
                        </span>
                      </td>
                      <td>
                        {sheet.route.from} → {sheet.route.to}
                      </td>
                      <td>{formatMiles(sheetSummary.sailMiles)} nm</td>
                      <td>{formatMiles(sheetSummary.motorMiles)} nm</td>
                      <td>{formatMiles(sheetSummary.totalMiles)} nm</td>
                      <td>{sheetSummary.duration}</td>
                      <td>{sheetSummary.motionDuration}</td>
                      <td>{sheetSummary.motorHoursDuration}</td>
                      <td>
                        <div className="table-row-actions">
                          <button
                            className="edit-chip"
                            onClick={() => {
                              openSheet(sheet);
                            }}
                            type="button"
                          >
                            Open
                          </button>
                          <button
                            className="edit-chip"
                            onClick={() => onPrintSheet(sheet.id)}
                            type="button"
                          >
                            {t("logbooks.printSheet")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
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
          />
        </article>
      </div>
      {isMapExpanded && (
        <div className="logbook-map-modal" role="dialog" aria-modal="true" aria-labelledby="logbook-overview-map-modal-title">
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
            />
          </div>
        </div>
      )}
    </section>
  );
}

import { useI18n } from "../../../lib/i18n";
import { useRef, type Dispatch, type SetStateAction } from "react";
import type {
  Boat,
  LogSheet,
  PersistedLogbook,
  SheetForm,
} from "../../../models/logbook";
import { defaultSheetForm, sheetToForm } from "../forms";
import { LogSheetsMapView } from "../OpenSeaMapView";

type Navigate = (
  module: "details" | "logbooks",
  itemId?: string | number,
) => void;
type SheetSummary = { motorMiles: number; sailMiles: number };

export function LogbookListPage({
  activeBoat,
  scannerBoatId,
  isScannerUploading,
  calculateSheetSummary,
  logbook,
  navigate,
  onScanFilesSelected,
  onScannerBoatChange,
  onCreateBoatRequested,
  setActiveSheetId,
  setEditingSheetId,
  setSheetForm,
  setShowNewSheet,
}: {
  activeBoat?: Boat;
  scannerBoatId: string;
  isScannerUploading: boolean;
  calculateSheetSummary: (sheet: LogSheet) => SheetSummary;
  logbook: PersistedLogbook;
  navigate: Navigate;
  onScanFilesSelected: (files: FileList | File[], boatId: string) => void;
  onScannerBoatChange: (boatId: string) => void;
  onCreateBoatRequested: () => void;
  setActiveSheetId: Dispatch<SetStateAction<string>>;
  setEditingSheetId: Dispatch<SetStateAction<string | null>>;
  setSheetForm: Dispatch<SetStateAction<SheetForm>>;
  setShowNewSheet: Dispatch<SetStateAction<boolean>>;
}) {
  const { t } = useI18n();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const hasBoats = logbook.boats.length > 0;
  const hasMultipleBoats = logbook.boats.length > 1;

  function handleScannerFilesSelected(files: FileList | null) {
    if (!files?.length) return;
    if (!scannerBoatId) return;
    onScanFilesSelected(files, scannerBoatId);
  }

  function openSheet(sheet: LogSheet) {
    setActiveSheetId(sheet.id);
    setSheetForm(sheetToForm(sheet));
    navigate("details", sheet.id);
  }

  return (
    <section className="logbook-page module-panel" aria-label={t("logbooks.aria")}>
      <div className="page-heading">
        <div>
          <h1>{t("logbooks.title")}</h1>
          <p>{t("logbooks.subtitle")}</p>
        </div>
        <button
          type="button"
          className="primary-action"
          onClick={() => {
            setEditingSheetId(null);
            if (!activeBoat) return;
            setSheetForm(defaultSheetForm(activeBoat.id));
            setShowNewSheet(true);
            navigate("details");
          }}
        >
          {t("logbooks.newSheet")}
        </button>
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
                {logbook.boats.map((boat) => (
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
            disabled={isScannerUploading}
            onClick={() => cameraInputRef.current?.click()}
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
            disabled={isScannerUploading}
            onClick={() => importInputRef.current?.click()}
          >
            {isScannerUploading
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
      <div className="logbook-toolbar">
        <input
          aria-label={t("logbooks.search")}
          placeholder={t("logbooks.searchPlaceholder")}
          readOnly
        />
        <select aria-label={t("logbooks.vesselFilter")} defaultValue={t("logbooks.allVessels")}>
          <option>{t("logbooks.allVessels")}</option>
        </select>
        <select aria-label={t("logbooks.timeFilter")} defaultValue={t("logbooks.allTime")}>
          <option>{t("logbooks.allTime")}</option>
        </select>
      </div>
      <div className="logbook-overview-layout">
        <article className="table-card logbook-list-card">
          <div className="logbook-list-heading">
            <h3>{t("logbooks.allSheets")}</h3>
          </div>
          <div className="table-scroll">
            <table className="logbook-table">
              <thead>
                <tr>
                  <th>{t("logbooks.date")}</th>
                  <th>{t("logbooks.entry")}</th>
                  <th>{t("logbooks.vessel")}</th>
                  <th>{t("logbooks.fromTo")}</th>
                  <th>{t("compliance.sailMiles")}</th>
                  <th>{t("compliance.motorMiles")}</th>
                  <th>{t("logbooks.totalMiles")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {logbook.sheets.map((sheet) => {
                  const boat = logbook.boats.find(
                    (candidate) => candidate.id === sheet.boatId,
                  );
                  const totalMiles = Math.max(
                    0,
                    ...sheet.lines.map((line) => line.logNm),
                  );
                  const sheetSummary = calculateSheetSummary(sheet);
                  return (
                    <tr key={sheet.id}>
                      <td>{sheet.dateRange}</td>
                      <td>
                        <button
                          className="table-title-button"
                          onClick={() => {
                            openSheet(sheet);
                          }}
                          type="button"
                        >
                          {sheet.title}
                        </button>
                      </td>
                      <td>
                        <span className="table-vessel">
                          <span className="picture-thumb" aria-hidden="true" />
                          {boat?.name}
                        </span>
                      </td>
                      <td>
                        {sheet.route.from} → {sheet.route.to}
                      </td>
                      <td>{sheetSummary.sailMiles} nm</td>
                      <td>{sheetSummary.motorMiles} nm</td>
                      <td>{totalMiles} nm</td>
                      <td>
                        <button
                          className="edit-chip"
                          onClick={() => {
                            openSheet(sheet);
                          }}
                          type="button"
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="pagination-mock" aria-hidden="true">
            <span className="active">1</span>
            <span>2</span>
            <span>3</span>
            <span>…</span>
            <span>8</span>
            <span>›</span>
          </div>
        </article>
        <article className="map-card logbook-overview-map-card">
          <div className="logbook-overview-map-heading">
            <p>{t("logbooks.mapHelp")}</p>
          </div>
          <LogSheetsMapView
            sheets={logbook.sheets}
            onSheetClick={openSheet}
            ariaLabel={t("logbooks.mapAria")}
            showRouteTargets={false}
          />
        </article>
      </div>
    </section>
  );
}

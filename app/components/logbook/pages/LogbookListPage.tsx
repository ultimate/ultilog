import { useI18n } from "../../../lib/i18n";
import type { Dispatch, SetStateAction } from "react";
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
  calculateSheetSummary,
  logbook,
  navigate,
  setActiveSheetId,
  setEditingSheetId,
  setSheetForm,
  setShowNewSheet,
}: {
  activeBoat: Boat;
  calculateSheetSummary: (sheet: LogSheet) => SheetSummary;
  logbook: PersistedLogbook;
  navigate: Navigate;
  setActiveSheetId: Dispatch<SetStateAction<string>>;
  setEditingSheetId: Dispatch<SetStateAction<string | null>>;
  setSheetForm: Dispatch<SetStateAction<SheetForm>>;
  setShowNewSheet: Dispatch<SetStateAction<boolean>>;
}) {
  const { t } = useI18n();

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
            setSheetForm(defaultSheetForm(activeBoat.id));
            setShowNewSheet(true);
            navigate("details");
          }}
        >
          {t("logbooks.newSheet")}
        </button>
      </div>
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

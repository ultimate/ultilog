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
  function openSheet(sheet: LogSheet) {
    setActiveSheetId(sheet.id);
    setSheetForm(sheetToForm(sheet));
    navigate("details", sheet.id);
  }

  return (
    <section className="logbook-page module-panel" aria-label="Log sheets">
      <div className="page-heading">
        <div>
          <h1>Logbooks</h1>
          <p>Manage all your logbook entries</p>
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
          + New sheet
        </button>
      </div>
      <div className="logbook-toolbar">
        <input
          aria-label="Search logbooks"
          placeholder="Search logbooks…"
          readOnly
        />
        <select aria-label="Vessel filter" defaultValue="All vessels">
          <option>All vessels</option>
        </select>
        <select aria-label="Time filter" defaultValue="All time">
          <option>All time</option>
        </select>
      </div>
      <article className="map-card logbook-overview-map-card">
        <div className="logbook-overview-map-heading">
          <div>
            <p className="eyebrow">Overview map</p>
            <h3>All log sheets</h3>
          </div>
          <p>Click a route section to open the corresponding logsheet.</p>
        </div>
        <LogSheetsMapView
          sheets={logbook.sheets}
          onSheetClick={openSheet}
          ariaLabel="Overview map of all log sheets"
        />
      </article>
      <article className="table-card logbook-list-card">
        <div className="table-scroll">
          <table className="logbook-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Entry</th>
                <th>Vessel</th>
                <th>From → To</th>
                <th>Sail miles</th>
                <th>Motor miles</th>
                <th>Total miles</th>
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
    </section>
  );
}

import { EntityImage } from "../EntityImage";
import { flagGroups, flagOptionEmoji } from "../../../lib/flags";
import { useI18n } from "../../../lib/i18n";
import { useMemo, useRef, type Dispatch, type SetStateAction } from "react";
import { windDriftSailSettings, type Boat, type BoatForm, type BoatType, type PersistedLogbook } from "../../../models/logbook";
import { boatToForm, defaultBoatForm } from "../forms";
import { modulePath } from "../persistence";
import { ManagerShell } from "../../managers/ManagerShell";
import { fileToStoredImage } from "../image-utils";
import * as Pagination from "../PaginationControls";

type BoatManagerPageProps = Record<string, any>;

function nonNegativeInputValue(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed < 0 ? "0" : value;
}

export function BoatManagerPage(props: BoatManagerPageProps) {
  const { t } = useI18n();
  const {
    showBoatManager,
    saveBoat,
    editingBoatId,
    cancelBoatEdit,
    deleteSelectedBoat,
    pushAppPath,
  } = props;
  const boatForm = props.boatForm as BoatForm;
  const logbook = props.logbook as PersistedLogbook;
  const selectedBoat = props.selectedBoat as Boat;
  const setBoatForm = props.setBoatForm as Dispatch<SetStateAction<BoatForm>>;
  const setEditingBoatId = props.setEditingBoatId as Dispatch<
    SetStateAction<string | null>
  >;
  const setSelectedBoatId = props.setSelectedBoatId as Dispatch<
    SetStateAction<string>
  >;
  const setShowBoatManager = props.setShowBoatManager as Dispatch<
    SetStateAction<boolean>
  >;
  const imageInputRef = useRef<HTMLInputElement>(null);
  const listPagination = Pagination.usePagination(logbook.boats, props.defaultPageSize as number);
  const selectedBoatSheets = useMemo(
    () => logbook.sheets.filter((sheet) => sheet.boatId === (editingBoatId ?? selectedBoat.id)),
    [editingBoatId, logbook.sheets, selectedBoat.id],
  );

  return (
    <section className="sheet-detail module-panel">
      <ManagerShell
        title={t("boats.title")}
        newLabel={t("boats.new")}
        onNew={() => {
          setEditingBoatId(null);
          setBoatForm(defaultBoatForm);
          setShowBoatManager(true);
        }}
        list={
          <>
          <ul className="manager-list">
            {listPagination.pageItems.map((boat) => (
              <li key={boat.id}>
                <button
                  type="button"
                  className={boat.id === editingBoatId ? "active" : ""}
                  onClick={() => {
                    setSelectedBoatId(boat.id);
                    setEditingBoatId(boat.id);
                    setBoatForm(boatToForm(boat));
                    setShowBoatManager(false);
                    pushAppPath(modulePath("boats", boat.id));
                  }}
                >
                  <EntityImage
                    image={boat.image}
                    entityType="boat"
                    alt={`${boat.name} thumbnail`}
                    variant="list"
                  />
                  <span>
                    <strong>{boat.name}</strong>
                    <small>
                      {boat.type} · {boat.registration || t("boats.noRegistration")}
                    </small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <Pagination.PaginationControls
            page={listPagination.page}
            pageCount={listPagination.pageCount}
            pageSize={listPagination.pageSize}
            totalItems={logbook.boats.length}
            onPageChange={listPagination.setPage}
            onPageSizeChange={listPagination.setPageSize}
          />
          </>
        }
        form={
          showBoatManager || editingBoatId ? (
          <form className="inline-edit-grid" onSubmit={saveBoat}>
            <p className="eyebrow">
              {showBoatManager ? t("boats.new") : t("boats.form")}
            </p>
            <label>
              {t("common.name")}
              <input
                required
                value={boatForm.name}
                onChange={(e) =>
                  setBoatForm({ ...boatForm, name: e.target.value })
                }
              />
            </label>
            <label>
              {t("common.type")}
              <select
                value={boatForm.type}
                onChange={(e) =>
                  setBoatForm({ ...boatForm, type: e.target.value as BoatType })
                }
              >
                <option>{t("boats.sail")}</option>
                <option>{t("boats.motor")}</option>
              </select>
            </label>
            <label>
              {t("common.registration")}
              <input
                value={boatForm.registration}
                onChange={(e) =>
                  setBoatForm({ ...boatForm, registration: e.target.value })
                }
              />
            </label>
            <div className="flag-chooser-field">
              <label htmlFor="boat-flag-state">{t("boats.flagState")}</label>
              <select
                id="boat-flag-state"
                className="flag-chooser"
                value={boatForm.flagState}
                onChange={(e) =>
                  setBoatForm({ ...boatForm, flagState: e.target.value })
                }
              >
                <option value="">{t("boats.flagPlaceholder")}</option>
                {boatForm.flagState &&
                  !flagGroups.some((group) =>
                    group.flags.some((flag) => flagOptionEmoji(flag) === boatForm.flagState),
                  ) ? (
                  <option value={boatForm.flagState} disabled>
                    {boatForm.flagState}
                  </option>
                ) : null}
                {flagGroups.map((group) => (
                  <optgroup key={group.continent} label={group.continent}>
                    {group.flags.map((flag) => {
                      const emoji = flagOptionEmoji(flag);

                      return (
                        <option key={flag.code} value={emoji}>
                          {emoji} {flag.name}
                        </option>
                      );
                    })}
                  </optgroup>
                ))}
              </select>
            </div>
            <label>
              {t("boats.homePort")}
              <input
                value={boatForm.homePort}
                onChange={(e) =>
                  setBoatForm({ ...boatForm, homePort: e.target.value })
                }
              />
            </label>
            <label>
              {t("common.owner")}
              <input
                value={boatForm.owner}
                onChange={(e) =>
                  setBoatForm({ ...boatForm, owner: e.target.value })
                }
              />
            </label>
            <label>
              {t("boats.dimensions")}
              <input
                value={boatForm.dimensions}
                onChange={(e) =>
                  setBoatForm({ ...boatForm, dimensions: e.target.value })
                }
              />
            </label>
            <label>
              {t("boats.manufacturer")}
              <input
                value={boatForm.manufacturer}
                onChange={(e) =>
                  setBoatForm({ ...boatForm, manufacturer: e.target.value })
                }
              />
            </label>
            <label>
              MMSI
              <input
                value={boatForm.mmsi}
                onChange={(e) =>
                  setBoatForm({ ...boatForm, mmsi: e.target.value })
                }
              />
            </label>
            <label>
              {t("boats.engine")}
              <input
                value={boatForm.engine}
                onChange={(e) =>
                  setBoatForm({ ...boatForm, engine: e.target.value })
                }
              />
            </label>

            <div className="image-form-field wide-field">
              <p className="eyebrow">Image</p>
              <div className="image-preview-frame">
                <EntityImage
                  image={boatForm.image}
                  entityType="boat"
                  alt={`${boatForm.name || t("boats.new")} preview`}
                  variant="preview"
                />
              </div>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="visually-hidden-file-input"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const image = await fileToStoredImage(file);
                    setBoatForm((current) => ({ ...current, image }));
                  } catch (error) {
                    alert(error instanceof Error ? error.message : "Image could not be processed.");
                  } finally {
                    e.currentTarget.value = "";
                  }
                }}
              />
              <div className="image-actions">
                <button type="button" className="ghost-button" onClick={() => imageInputRef.current?.click()}>
                  {boatForm.image ? "Change image" : "Upload image"}
                </button>
                {boatForm.image ? (
                  <button type="button" className="ghost-button" onClick={() => setBoatForm((current) => ({ ...current, image: undefined }))}>
                    Remove image
                  </button>
                ) : null}
              </div>
              {boatForm.image ? <small>{boatForm.image.width} × {boatForm.image.height} · {boatForm.image.mimeType}</small> : null}
            </div>
            <label className="wide-field">
              {t("boats.safety")}
              <textarea
                value={boatForm.safety}
                onChange={(e) =>
                  setBoatForm({ ...boatForm, safety: e.target.value })
                }
              />
            </label>
            <label>
              {t("boats.logfactor")}
              <input
                required
                type="number"
                min="0.000001"
                step="0.000001"
                value={boatForm.logfactor}
                onChange={(e) =>
                  setBoatForm({ ...boatForm, logfactor: Number(e.target.value) })
                }
              />
            </label>
            <details className="wide-field deviation-table-field">
              <summary>
                <span className="eyebrow">{t("boats.deviationTable")}</span>
                <span>{t("boats.deviationHelp")}</span>
              </summary>
              <div className="table-scroll">
                <table className="deviation-table">
                  <thead>
                    <tr>
                      <th>{t("boats.heading")}</th>
                      <th>{t("boats.deviation")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {boatForm.deviationTable.map((row, index) => (
                      <tr key={row.heading}>
                        <td>{row.heading}°</td>
                        <td>
                          <input
                            aria-label={`${t("boats.deviation")} ${row.heading}°`}
                            value={row.deviation}
                            onChange={(e) =>
                              setBoatForm({
                                ...boatForm,
                                deviationTable: boatForm.deviationTable.map(
                                  (candidate, candidateIndex) =>
                                    candidateIndex === index
                                      ? {
                                          ...candidate,
                                          deviation: e.target.value,
                                        }
                                      : candidate,
                                ),
                              })
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>

            <details className="wide-field deviation-table-field">
              <summary>
                <span className="eyebrow">{t("boats.windDriftTable")}</span>
                <span>{t("boats.windDriftHelp")}</span>
              </summary>
              <div className="table-scroll">
                <table className="deviation-table">
                  <thead>
                    <tr>
                      <th>{t("boats.windAngle")}</th>
                      {windDriftSailSettings.map((setting) => (
                        <th key={setting}>
                          <span>{t(`boats.windDrift.${setting}`)}</span>
                          <label className="wind-drift-value">
                            <input
                              aria-label={`${t(`boats.windDrift.${setting}`)} ${t("boats.windSpeedLimit")} [kn]`}
                              type="number"
                              min="0"
                              step="0.1"
                              disabled={setting === "fullSail"}
                              value={boatForm.windDriftTable.windSpeedLimits[setting]}
                              onChange={(e) =>
                                setBoatForm({
                                  ...boatForm,
                                  windDriftTable: {
                                    ...boatForm.windDriftTable,
                                    windSpeedLimits: { ...boatForm.windDriftTable.windSpeedLimits, [setting]: nonNegativeInputValue(e.target.value) },
                                  },
                                })
                              }
                            />
                            <span>[kn]</span>
                          </label>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {boatForm.windDriftTable.rows.map((row, index) => (
                      <tr key={row.angle}>
                        <td>{t(`boats.windDrift.${row.angle}`)}</td>
                        {windDriftSailSettings.map((setting) => (
                          <td key={setting}>
                            <label className="wind-drift-value">
                              <input
                                aria-label={`${t(`boats.windDrift.${row.angle}`)} ${t(`boats.windDrift.${setting}`)} °`}
                                type="number"
                                min="0"
                                step="0.1"
                                value={row.values[setting]}
                                onChange={(e) =>
                                  setBoatForm({
                                    ...boatForm,
                                    windDriftTable: {
                                      ...boatForm.windDriftTable,
                                      rows: boatForm.windDriftTable.rows.map((candidate, candidateIndex) =>
                                      candidateIndex === index
                                        ? { ...candidate, values: { ...candidate.values, [setting]: nonNegativeInputValue(e.target.value) } }
                                        : candidate,
                                      ),
                                    },
                                  })
                                }
                              />
                              <span>°</span>
                            </label>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
            <article className="info-card wide-field">
              <h3>{t("boats.logSheets")}</h3>
              <ul className="stack-list">
                {selectedBoatSheets.map((sheet) => (
                  <li key={sheet.id}>
                    <strong>{sheet.title}</strong>
                    <small>{sheet.dateRange}</small>
                  </li>
                ))}
              </ul>
            </article>
            <div className="inline-edit-actions">
              <button type="submit">
                {showBoatManager ? t("boats.create") : t("boats.save")}
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={cancelBoatEdit}
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                className="ghost-button"
                disabled={logbook.sheets.some(
                  (sheet) => sheet.boatId === selectedBoat.id,
                )}
                onClick={deleteSelectedBoat}
              >
                {t("boats.delete")}
              </button>
            </div>
          </form>
          ) : (
            <p className="empty-state">{t("common.selectEntry")}</p>
          )
        }
      />
    </section>
  );
}

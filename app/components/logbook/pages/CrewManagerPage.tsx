import { EntityImage } from "../EntityImage";
import { useI18n } from "../../../lib/i18n";
import { useMemo, useRef, type Dispatch, type SetStateAction } from "react";
import type {
  CrewForm,
  LogSheet,
  PersistedLogbook,
} from "../../../models/logbook";
import { defaultCrewForm } from "../forms";
import { modulePath } from "../persistence";
import { ManagerShell } from "../../managers/ManagerShell";
import { fileToStoredImage } from "../image-utils";
import { ListPagination, ListSearch, useSortableList } from "../SortableList";

type CrewAssignment = {
  member: PersistedLogbook["crewMembers"][number];
  sheets: { sheet: LogSheet; isSkipper: boolean }[];
};
type CrewManagerPageProps = Record<string, any>;

export function CrewManagerPage(props: CrewManagerPageProps) {
  const { t } = useI18n();
  const {
    selectedCrewIndex,
    lastCrewIndex,
    setLastCrewIndex,
    setSelectedCrewIndex,
    selectCrew,
    pushAppPath,
    saveCrew,
    cancelCrewEdit,
    deleteSelectedCrew,
  } = props;
  const crewForm = props.crewForm as CrewForm;
  const crewAssignments = props.crewAssignments as CrewAssignment[];
  const logbook = props.logbook as PersistedLogbook;
  const setCrewForm = props.setCrewForm as Dispatch<SetStateAction<CrewForm>>;
  const imageInputRef = useRef<HTMLInputElement>(null);
  const columns = useMemo(() => [
    { key: "name", value: (person: PersistedLogbook["crewMembers"][number]) => person.name },
    { key: "nationality", value: (person: PersistedLogbook["crewMembers"][number]) => person.nationality },
    { key: "role", value: (person: PersistedLogbook["crewMembers"][number]) => person.role },
    { key: "address", value: (person: PersistedLogbook["crewMembers"][number]) => person.address },
    { key: "certificate", value: (person: PersistedLogbook["crewMembers"][number]) => person.certificate },
  ], []);
  const list = useSortableList(logbook.crewMembers, columns, props.defaultPageSize as number);

  return (
    <section className="sheet-detail module-panel">
      <ManagerShell
        title={t("crew.title")}
        newLabel={t("crew.new")}
        onNew={() => {
          setLastCrewIndex(
            selectedCrewIndex >= 0 ? selectedCrewIndex : lastCrewIndex,
          );
          setSelectedCrewIndex(-1);
          setCrewForm(defaultCrewForm);
        }}
        list={
          <>
          <ListSearch value={list.query} onChange={list.setQuery} />
          <div className="manager-list-sort">
            <label>{t("list.sortBy")} <select value={list.sort.key} onChange={(event) => list.setSortKey(event.target.value)}><option value="">{t("common.name")}</option>{columns.map((column) => <option key={column.key} value={column.key}>{t(column.key === "name" ? "common.name" : `crew.${column.key}` as any)}</option>)}</select></label>
            <button type="button" className="edit-chip" disabled={!list.sort.key} onClick={() => list.sort.key && list.setSortKey(list.sort.key)} aria-label={t("list.toggleDirection")}>{list.sort.direction === "ascending" ? "▲" : "▼"}</button>
          </div>
          <ul className="manager-list">
            {list.pageItems.map((person) => {
              const index = logbook.crewMembers.findIndex((candidate) => candidate.id === person.id);
              return (
              <li key={person.id}>
                <button
                  type="button"
                  className={index === selectedCrewIndex ? "active" : ""}
                  onClick={() => {
                    selectCrew(index);
                    pushAppPath(modulePath("crew", index));
                  }}
                >
                  <EntityImage
                    image={person.image}
                    entityType="crew"
                    alt={`${person.name} avatar`}
                    variant="list"
                  />
                  <span>
                    <strong>
                      {person.isPrimary ? "⭐ " : ""}
                      {person.name}
                    </strong>
                    <small>{person.role || t("crew.member")}</small>
                  </span>
                </button>
              </li>
            );
            })}
          </ul>
          <ListPagination list={list} />
          </>
        }
        form={
          selectedCrewIndex >= -1 ? (
          <form
            className="inline-edit-grid"
            onSubmit={async (event) => {
              event.preventDefault();
              await saveCrew();
            }}
          >
            <p className="eyebrow">
              {selectedCrewIndex < 0
                ? t("crew.newProfile")
                : crewForm.isPrimary
                  ? t("crew.thisIsMe")
                  : t("crew.profile")}
            </p>
            <label>
              {t("common.name")}
              <input
                value={crewForm.name}
                onChange={(e) =>
                  setCrewForm({ ...crewForm, name: e.target.value })
                }
              />
            </label>
            <label>
              {t("crew.nationality")}
              <input
                value={crewForm.nationality}
                onChange={(e) =>
                  setCrewForm({ ...crewForm, nationality: e.target.value })
                }
              />
            </label>
            <label>
              {t("crew.role")}
              <input
                value={crewForm.role}
                onChange={(e) =>
                  setCrewForm({ ...crewForm, role: e.target.value })
                }
              />
            </label>
            <label>
              {t("crew.address")}
              <input
                value={crewForm.address ?? ""}
                onChange={(e) =>
                  setCrewForm({ ...crewForm, address: e.target.value })
                }
              />
            </label>
            <label className="wide-field">
              {t("crew.certificate")}
              <input
                value={crewForm.certificate ?? ""}
                onChange={(e) =>
                  setCrewForm({ ...crewForm, certificate: e.target.value })
                }
              />
            </label>

            <div className="image-form-field wide-field">
              <p className="eyebrow">Image</p>
              <div className="image-preview-frame">
                <EntityImage
                  image={crewForm.image}
                  entityType="crew"
                  alt={`${crewForm.name || t("crew.newProfile")} preview`}
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
                    setCrewForm((current) => ({ ...current, image }));
                  } catch (error) {
                    alert(error instanceof Error ? error.message : "Image could not be processed.");
                  } finally {
                    e.currentTarget.value = "";
                  }
                }}
              />
              <div className="image-actions">
                <button type="button" className="ghost-button" onClick={() => imageInputRef.current?.click()}>
                  {crewForm.image ? "Change image" : "Upload image"}
                </button>
                {crewForm.image ? (
                  <button type="button" className="ghost-button" onClick={() => setCrewForm((current) => ({ ...current, image: undefined }))}>
                    Remove image
                  </button>
                ) : null}
              </div>
              {crewForm.image ? <small>{crewForm.image.width} × {crewForm.image.height} · {crewForm.image.mimeType}</small> : null}
            </div>
            <article className="info-card wide-field">
              <h3>{t("crew.logSheets")}</h3>
              <ul className="stack-list">
                {(
                  crewAssignments.find(
                    (entry) => entry.member.id === crewForm.id,
                  )?.sheets ?? []
                ).map(({ sheet, isSkipper }) => (
                  <li key={sheet.id}>
                    <strong>
                      {isSkipper ? `⭐ ${t("crew.skipper")} · ` : `${t("crew.label")} · `}
                      {sheet.title}
                    </strong>
                    <small>{sheet.dateRange}</small>
                  </li>
                ))}
              </ul>
            </article>
            <div className="inline-edit-actions">
              <button type="submit">{t("crew.save")}</button>
              <button
                type="button"
                className="ghost-button"
                onClick={cancelCrewEdit}
              >
                Cancel
              </button>
              <button
                type="button"
                className="ghost-button"
                disabled={
                  crewForm.isPrimary ||
                  crewForm.id === "me" ||
                  Boolean(
                    crewAssignments.find(
                      (entry) => entry.member.id === crewForm.id,
                    )?.sheets.length,
                  )
                }
                onClick={deleteSelectedCrew}
              >
                Delete
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

import type { Dispatch, SetStateAction } from "react";
import type {
  CrewForm,
  LogSheet,
  PersistedLogbook,
} from "../../../models/logbook";
import { defaultCrewForm } from "../forms";
import { modulePath } from "../persistence";
import { ManagerShell } from "../../managers/ManagerShell";

type CrewAssignment = {
  member: PersistedLogbook["crewMembers"][number];
  sheets: { sheet: LogSheet; isSkipper: boolean }[];
};
type CrewManagerPageProps = Record<string, any>;

export function CrewManagerPage(props: CrewManagerPageProps) {
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

  return (
    <section className="sheet-detail module-panel">
      <ManagerShell
        title="Crew"
        newLabel="New crew"
        onNew={() => {
          setLastCrewIndex(
            selectedCrewIndex >= 0 ? selectedCrewIndex : lastCrewIndex,
          );
          setSelectedCrewIndex(-1);
          setCrewForm(defaultCrewForm);
        }}
        list={
          <ul className="manager-list">
            {logbook.crewMembers.map((person, index) => (
              <li key={person.id}>
                <button
                  type="button"
                  className={index === selectedCrewIndex ? "active" : ""}
                  onClick={() => {
                    selectCrew(index);
                    pushAppPath(modulePath("crew", index));
                  }}
                >
                  <span>
                    <strong>
                      {person.isPrimary ? "⭐ " : ""}
                      {person.name}
                    </strong>
                    <small>{person.role || "Crew member"}</small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        }
        form={
          <form
            className="inline-edit-grid"
            onSubmit={async (event) => {
              event.preventDefault();
              await saveCrew();
            }}
          >
            <p className="eyebrow">
              {selectedCrewIndex < 0
                ? "New crew profile"
                : crewForm.isPrimary
                  ? "This is me"
                  : "Crew profile"}
            </p>
            <label>
              Name
              <input
                value={crewForm.name}
                onChange={(e) =>
                  setCrewForm({ ...crewForm, name: e.target.value })
                }
              />
            </label>
            <label>
              Nationality
              <input
                value={crewForm.nationality}
                onChange={(e) =>
                  setCrewForm({ ...crewForm, nationality: e.target.value })
                }
              />
            </label>
            <label>
              Role
              <input
                value={crewForm.role}
                onChange={(e) =>
                  setCrewForm({ ...crewForm, role: e.target.value })
                }
              />
            </label>
            <label>
              Address
              <input
                value={crewForm.address ?? ""}
                onChange={(e) =>
                  setCrewForm({ ...crewForm, address: e.target.value })
                }
              />
            </label>
            <label className="wide-field">
              Skipper certificate
              <input
                value={crewForm.certificate ?? ""}
                onChange={(e) =>
                  setCrewForm({ ...crewForm, certificate: e.target.value })
                }
              />
            </label>
            <article className="info-card wide-field">
              <h3>Log sheets</h3>
              <ul className="stack-list">
                {(
                  crewAssignments.find(
                    (entry) => entry.member.id === crewForm.id,
                  )?.sheets ?? []
                ).map(({ sheet, isSkipper }) => (
                  <li key={sheet.id}>
                    <strong>
                      {isSkipper ? "⭐ Skipper · " : "Crew · "}
                      {sheet.title}
                    </strong>
                    <small>{sheet.dateRange}</small>
                  </li>
                ))}
              </ul>
            </article>
            <div className="inline-edit-actions">
              <button type="submit">Save crew</button>
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
        }
      />
    </section>
  );
}

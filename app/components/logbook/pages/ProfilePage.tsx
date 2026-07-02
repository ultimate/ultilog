import type { Dispatch, SetStateAction } from "react";
import type { Boat, PersistedLogbook } from "../../../models/logbook";
import { PasswordField } from "../../PasswordField";

type ProfilePageProps = Record<string, any>;

export function ProfilePage(props: ProfilePageProps) {
  const {
    logout,
    isLoggingOut,
    accountName,
    accountEmail,
    profileMessage,
    profileError,
    updateName,
    updateEmail,
    updatePassword,
    deleteAccount,
    selectCrew,
    navigate,
    theme,
  } = props;
  const userGroups = props.userGroups as string[];
  const logbook = props.logbook as PersistedLogbook;
  const activeBoat = props.activeBoat as Boat;
  const nameForm = props.nameForm as { name: string; currentPassword: string };
  const emailForm = props.emailForm as {
    email: string;
    currentPassword: string;
  };
  const passwordForm = props.passwordForm as {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  };
  const deleteForm = props.deleteForm as {
    currentPassword: string;
    confirmation: string;
  };
  const setNameForm = props.setNameForm as Dispatch<
    SetStateAction<typeof nameForm>
  >;
  const setEmailForm = props.setEmailForm as Dispatch<
    SetStateAction<typeof emailForm>
  >;
  const setPasswordForm = props.setPasswordForm as Dispatch<
    SetStateAction<typeof passwordForm>
  >;
  const setDeleteForm = props.setDeleteForm as Dispatch<
    SetStateAction<typeof deleteForm>
  >;

  return (
    <section className="profile-page module-panel" aria-label="Profile page">
      <div className="page-heading">
        <div>
          <h1>Profile</h1>
          <p>Personal settings and account details.</p>
        </div>
        <button className="secondary-action" type="button" onClick={logout}>
          {isLoggingOut ? "Saving…" : "Logout"}
        </button>
      </div>
      <section className="profile-grid">
        <article className="profile-hero-card">
          <span className="profile-avatar">ME</span>
          <div>
            <p className="eyebrow">User profile</p>
            <h2>
              {accountName ||
                logbook.crewMembers.find((crew) => crew.isPrimary)?.name ||
                "My profile"}
            </h2>
            <p>{accountEmail || "No email set"}</p>
            <p className="group-tags">
              {userGroups.length ? (
                userGroups.map((group) => <span key={group}>{group}</span>)
              ) : (
                <span>No groups</span>
              )}
            </p>
            <button
              type="button"
              className="edit-chip"
              onClick={() => {
                const meIndex = logbook.crewMembers.findIndex(
                  (crew) => crew.isPrimary,
                );
                if (meIndex >= 0) {
                  selectCrew(meIndex);
                  navigate("crew", meIndex);
                }
              }}
            >
              Show my crew member details
            </button>
          </div>
        </article>
        {(profileMessage || profileError) && (
          <article className="info-card">
            <h3>Account status</h3>
            {profileMessage && <p className="save-success">{profileMessage}</p>}
            {profileError && <p className="save-error">{profileError}</p>}
          </article>
        )}
        <form className="info-card inline-edit-grid" onSubmit={updateName}>
          <h3>Change username</h3>
          <label className="wide-field">
            New username
            <input
              required
              value={nameForm.name}
              onChange={(e) =>
                setNameForm({ ...nameForm, name: e.target.value })
              }
            />
          </label>
          <PasswordField
            className="wide-field"
            label="Current password"
            required
            value={nameForm.currentPassword}
            onChange={(e) =>
              setNameForm({ ...nameForm, currentPassword: e.target.value })
            }
          />
          <div className="inline-edit-actions">
            <button type="submit">Update username</button>
          </div>
          <p className="wide-field">
            Usernames must be unique and may not contain reserved or abusive
            terms.
          </p>
        </form>
        <form className="info-card inline-edit-grid" onSubmit={updateEmail}>
          <h3>Change email</h3>
          <label className="wide-field">
            New email
            <input
              type="email"
              required
              value={emailForm.email}
              onChange={(e) =>
                setEmailForm({ ...emailForm, email: e.target.value })
              }
            />
          </label>
          <PasswordField
            className="wide-field"
            label="Current password"
            required
            value={emailForm.currentPassword}
            onChange={(e) =>
              setEmailForm({ ...emailForm, currentPassword: e.target.value })
            }
          />
          <div className="inline-edit-actions">
            <button type="submit">Update email</button>
          </div>
        </form>
        <form className="info-card inline-edit-grid" onSubmit={updatePassword}>
          <h3>Change password</h3>
          <PasswordField
            className="wide-field"
            label="Current password"
            required
            value={passwordForm.currentPassword}
            onChange={(e) =>
              setPasswordForm({
                ...passwordForm,
                currentPassword: e.target.value,
              })
            }
          />
          <PasswordField
            className="wide-field"
            label="New password"
            required
            minLength={8}
            value={passwordForm.newPassword}
            onChange={(e) =>
              setPasswordForm({ ...passwordForm, newPassword: e.target.value })
            }
          />
          <PasswordField
            className="wide-field"
            label="Confirm new password"
            required
            minLength={8}
            value={passwordForm.confirmPassword}
            onChange={(e) =>
              setPasswordForm({
                ...passwordForm,
                confirmPassword: e.target.value,
              })
            }
          />
          <div className="inline-edit-actions">
            <button type="submit">Update password</button>
          </div>
        </form>
        <article className="info-card">
          <h3>Preferences</h3>
          <dl>
            <div>
              <dt>Theme</dt>
              <dd>{theme === "dark" ? "Dark mode" : "Light mode"}</dd>
            </div>
            <div>
              <dt>Distance units</dt>
              <dd>Nautical miles</dd>
            </div>
            <div>
              <dt>Default vessel</dt>
              <dd>{activeBoat.name}</dd>
            </div>
          </dl>
        </article>
        <form className="info-card inline-edit-grid" onSubmit={deleteAccount}>
          <h3>Delete account</h3>
          <p className="wide-field">
            This permanently deletes your account and all logbooks, boats, crew
            members, and log lines.
          </p>
          <PasswordField
            className="wide-field"
            label="Current password"
            required
            value={deleteForm.currentPassword}
            onChange={(e) =>
              setDeleteForm({ ...deleteForm, currentPassword: e.target.value })
            }
          />
          <label className="wide-field">
            Type DELETE to confirm
            <input
              required
              value={deleteForm.confirmation}
              onChange={(e) =>
                setDeleteForm({ ...deleteForm, confirmation: e.target.value })
              }
            />
          </label>
          <div className="inline-edit-actions">
            <button type="submit" className="ghost-button">
              Delete account
            </button>
          </div>
        </form>
      </section>
    </section>
  );
}

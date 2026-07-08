import { useI18n } from "../../../lib/i18n";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import type { Boat, PersistedLogbook } from "../../../models/logbook";
import { PasswordField } from "../../PasswordField";

type ProfilePageProps = Record<string, any>;

export function ProfilePage(props: ProfilePageProps) {
  const { t } = useI18n();
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
  const onboardingChecklist = props.onboardingChecklist as ReactNode;
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
    <section className="profile-page module-panel" aria-label={t("profile.aria")}>
      <div className="page-heading">
        <div>
          <h1>{t("profile.title")}</h1>
          <p>{t("profile.subtitle")}</p>
        </div>
        <button className="secondary-action" type="button" onClick={logout}>
          {isLoggingOut ? t("nav.saving") : t("nav.logout")}
        </button>
      </div>
      <section className="profile-grid">
        <article className="profile-hero-card">
          <span className="profile-avatar">ME</span>
          <div>
            <p className="eyebrow">{t("profile.userProfile")}</p>
            <h2>
              {accountName ||
                logbook.crewMembers.find((crew) => crew.isPrimary)?.name ||
                t("profile.myProfile")}
            </h2>
            <p>{accountEmail || t("profile.noEmail")}</p>
            <p className="group-tags">
              {userGroups.length ? (
                userGroups.map((group) => <span key={group}>{group}</span>)
              ) : (
                <span>{t("profile.noGroups")}</span>
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
              {t("profile.showCrew")}
            </button>
          </div>
        </article>
        {onboardingChecklist}
        {(profileMessage || profileError) && (
          <article className="info-card">
            <h3>{t("profile.accountStatus")}</h3>
            {profileMessage && <p className="save-success">{profileMessage}</p>}
            {profileError && <p className="save-error">{profileError}</p>}
          </article>
        )}
        <form className="info-card inline-edit-grid" onSubmit={updateName}>
          <h3>{t("profile.changeUsername")}</h3>
          <label className="wide-field">
            {t("profile.newUsername")}
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
            label={t("profile.currentPassword")}
            required
            value={nameForm.currentPassword}
            onChange={(e) =>
              setNameForm({ ...nameForm, currentPassword: e.target.value })
            }
          />
          <div className="inline-edit-actions">
            <button type="submit">{t("profile.updateUsername")}</button>
          </div>
          <p className="wide-field">
            {t("profile.usernameHelp")}
          </p>
        </form>
        <form className="info-card inline-edit-grid" onSubmit={updateEmail}>
          <h3>{t("profile.changeEmail")}</h3>
          <label className="wide-field">
            {t("profile.newEmail")}
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
            label={t("profile.currentPassword")}
            required
            value={emailForm.currentPassword}
            onChange={(e) =>
              setEmailForm({ ...emailForm, currentPassword: e.target.value })
            }
          />
          <div className="inline-edit-actions">
            <button type="submit">{t("profile.updateEmail")}</button>
          </div>
        </form>
        <form className="info-card inline-edit-grid" onSubmit={updatePassword}>
          <h3>{t("profile.changePassword")}</h3>
          <PasswordField
            className="wide-field"
            label={t("profile.currentPassword")}
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
            label={t("profile.newPassword")}
            required
            minLength={8}
            value={passwordForm.newPassword}
            onChange={(e) =>
              setPasswordForm({ ...passwordForm, newPassword: e.target.value })
            }
          />
          <PasswordField
            className="wide-field"
            label={t("profile.confirmNewPassword")}
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
            <button type="submit">{t("profile.updatePassword")}</button>
          </div>
        </form>
        <article className="info-card">
          <h3>{t("profile.preferences")}</h3>
          <dl>
            <div>
              <dt>{t("profile.theme")}</dt>
              <dd>{theme === "dark" ? t("profile.darkMode") : t("profile.lightMode")}</dd>
            </div>
            <div>
              <dt>{t("profile.distanceUnits")}</dt>
              <dd>{t("profile.nauticalMiles")}</dd>
            </div>
            <div>
              <dt>{t("profile.defaultVessel")}</dt>
              <dd>{activeBoat.name}</dd>
            </div>
          </dl>
        </article>
        <form className="info-card inline-edit-grid" onSubmit={deleteAccount}>
          <h3>{t("profile.deleteAccount")}</h3>
          <p className="wide-field">
            {t("profile.deleteHelp")}
          </p>
          <PasswordField
            className="wide-field"
            label={t("profile.currentPassword")}
            required
            value={deleteForm.currentPassword}
            onChange={(e) =>
              setDeleteForm({ ...deleteForm, currentPassword: e.target.value })
            }
          />
          <label className="wide-field">
            {t("profile.typeDelete")}
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

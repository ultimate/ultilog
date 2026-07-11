import { useI18n } from "../../../lib/i18n";
import type { FormEvent, Dispatch, ReactNode, SetStateAction } from "react";
import type { Boat, PersistedLogbook } from "../../../models/logbook";
import { PasswordField } from "../../PasswordField";
import type { ProfilePreferences } from "../../onboarding/useOnboardingProfile";

type ProfilePageProps = Record<string, any>;

export function ProfilePage(props: ProfilePageProps) {
  const { t, locales, localeLabels } = useI18n();
  const {
    logout,
    isLoggingOut,
    accountName,
    accountEmail,
    isAccountEmailVerified,
    profileMessage,
    profileError,
    updateName,
    updateEmail,
    updatePassword,
    deleteAccount,
    selectCrew,
    navigate,
    theme,
    preferences,
    updateViewPreferences,
  } = props;
  const userGroups = props.userGroups as string[];
  const logbook = props.logbook as PersistedLogbook;
  const activeBoat = props.activeBoat as Boat;
  const profilePreferences = preferences as ProfilePreferences;
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
            {accountEmail ? (
              <p className={isAccountEmailVerified ? "save-success" : "save-warning"}>
                {isAccountEmailVerified ? t("profile.emailVerified") : t("profile.emailUnverified")}
              </p>
            ) : null}
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
          <p className={isAccountEmailVerified ? "save-success wide-field" : "save-warning wide-field"}>
            {isAccountEmailVerified ? t("profile.emailVerifiedHelp") : t("profile.emailUnverifiedHelp")}
          </p>
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
        <form
          className="info-card inline-edit-grid"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            updateViewPreferences(profilePreferences);
          }}
        >
          <h3>{t("profile.preferences")}</h3>
          <fieldset className="preference-group wide-field">
            <legend>{t("profile.regionSettings")}</legend>
            <div className="preference-group-grid">
              <label>
                {t("profile.countryCode")}
                <input
                  value={profilePreferences.countryCode}
                  maxLength={2}
                  placeholder="US"
                  onChange={(event) => updateViewPreferences({ countryCode: event.target.value.toUpperCase() })}
                />
              </label>
              <label>
                {t("profile.language")}
                <select value={profilePreferences.language} onChange={(event) => updateViewPreferences({ language: event.target.value as ProfilePreferences["language"] })}>
                  {locales.map((locale) => <option key={locale} value={locale}>{localeLabels[locale]}</option>)}
                </select>
              </label>
            </div>
          </fieldset>
          <fieldset className="preference-group wide-field">
            <legend>{t("profile.unitSettings")}</legend>
            <div className="preference-group-grid">
              <label>
                {t("profile.windUnit")}
                <select value={profilePreferences.windUnit} onChange={(event) => updateViewPreferences({ windUnit: event.target.value as ProfilePreferences["windUnit"] })}>
                  {["bft", "kn", "km/h", "mp/h", "m/s"].map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                </select>
              </label>
              <label>
                {t("profile.waveTideUnit")}
                <select value={profilePreferences.waterHeightUnit} onChange={(event) => updateViewPreferences({ waterHeightUnit: event.target.value as ProfilePreferences["waterHeightUnit"] })}>
                  {["m", "ft"].map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                </select>
              </label>
              <label>
                {t("profile.temperatureUnit")}
                <select value={profilePreferences.temperatureUnit} onChange={(event) => updateViewPreferences({ temperatureUnit: event.target.value as ProfilePreferences["temperatureUnit"] })}>
                  {["°C", "°F"].map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                </select>
              </label>
              <label>
                {t("profile.coordinateFormat")}
                <select value={profilePreferences.coordinateFormat} onChange={(event) => updateViewPreferences({ coordinateFormat: event.target.value as ProfilePreferences["coordinateFormat"] })}>
                  <option value="decimal">{t("profile.coordinateDecimal")}</option>
                  <option value="dms">{t("profile.coordinateDms")}</option>
                </select>
              </label>
              <label>
                {t("profile.additionalDistanceDisplay")}
                <select value={profilePreferences.distanceDisplayUnit} onChange={(event) => updateViewPreferences({ distanceDisplayUnit: event.target.value as ProfilePreferences["distanceDisplayUnit"] })}>
                  <option value="off">{t("profile.off")}</option>
                  <option value="m">m</option>
                  <option value="km">km</option>
                </select>
              </label>
            </div>
          </fieldset>
          <fieldset className="preference-group wide-field">
            <legend>{t("profile.defaultSettings")}</legend>
            <div className="preference-group-grid">
              <label>
                {t("profile.defaultVessel")}
                <select value={profilePreferences.defaultBoatId || activeBoat.id} onChange={(event) => updateViewPreferences({ defaultBoatId: event.target.value })}>
                  {logbook.boats.map((boat) => <option key={boat.id} value={boat.id}>{boat.name}</option>)}
                </select>
              </label>
              <label>
                {t("profile.defaultCrewMembers")}
                <select multiple value={profilePreferences.defaultCrewMemberIds} onChange={(event) => updateViewPreferences({ defaultCrewMemberIds: Array.from(event.target.selectedOptions, (option) => option.value) })}>
                  {logbook.crewMembers.map((crew) => <option key={crew.id} value={crew.id}>{crew.name}</option>)}
                </select>
              </label>
            </div>
          </fieldset>
          <fieldset className="preference-group wide-field">
            <legend>{t("profile.displaySettings")}</legend>
            <div className="preference-group-grid">
              <label>
                {t("profile.theme")}
                <select value={theme} onChange={(event) => updateViewPreferences({ theme: event.target.value as ProfilePreferences["theme"] })}>
                  <option value="light">{t("profile.lightMode")}</option>
                  <option value="dark">{t("profile.darkMode")}</option>
                  <option value="auto">{t("profile.autoMode")}</option>
                </select>
              </label>
              <label>
                {t("profile.sidebarMode")}
                <select value={profilePreferences.isNavSlim ? "slim" : "wide"} onChange={(event) => updateViewPreferences({ isNavSlim: event.target.value === "slim" })}>
                  <option value="slim">{t("profile.sidebarSlim")}</option>
                  <option value="wide">{t("profile.sidebarWide")}</option>
                </select>
              </label>
              <label>
                {t("profile.showCourseConversionTable")}
                <select value={profilePreferences.showCourseConversionTable ? "yes" : "no"} onChange={(event) => updateViewPreferences({ showCourseConversionTable: event.target.value === "yes" })}>
                  <option value="yes">{t("common.yes")}</option>
                  <option value="no">{t("common.no")}</option>
                </select>
              </label>
            </div>
          </fieldset>
          <div className="inline-edit-actions">
            <button type="submit">{t("profile.savePreferences")}</button>
          </div>
        </form>
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
              {t("common.delete")}
            </button>
          </div>
        </form>
      </section>
    </section>
  );
}

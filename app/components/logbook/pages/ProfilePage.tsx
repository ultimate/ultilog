import { useEffect, useState } from "react";
import Image from "next/image";
import { useI18n } from "../../../lib/i18n";
import type { ChangeEvent, FormEvent, Dispatch, ReactNode, SetStateAction } from "react";
import type { Boat, PersistedLogbook } from "../../../models/logbook";
import { PasswordField } from "../../PasswordField";
import type { ProfilePreferences } from "../../onboarding/useOnboardingProfile";
import { dateFormats, formatStoredDate, formatStoredTime, timeFormats } from "../../../lib/date-time-format";
import { STANDARD_TECHNICAL_CHECK_IDS, standardTechnicalLogTemplate, type StandardTechnicalCheckId } from "../../../domain/logbook/technical-log";
import { pageSizeOptions, normalizePageSize } from "../PaginationControls";
import { CountryFlagSelector } from "../../CountryFlagSelector";

type ProfilePageProps = Record<string, any>;

type AvatarCrop = { file: File; url: string; width: number; height: number; zoom: number; x: number; y: number };

function cropGeometry(width: number, height: number, outputSize: number, zoom: number, x: number, y: number) {
  const scale = Math.max(outputSize / width, outputSize / height) * zoom;
  const scaledWidth = width * scale;
  const scaledHeight = height * scale;
  const overflowX = Math.max(0, scaledWidth - outputSize);
  const overflowY = Math.max(0, scaledHeight - outputSize);
  return {
    width: scaledWidth,
    height: scaledHeight,
    left: (outputSize - scaledWidth) / 2 + (x / 100) * (overflowX / 2),
    top: (outputSize - scaledHeight) / 2 + (y / 100) * (overflowY / 2),
  };
}

async function cropImageToSquare(crop: AvatarCrop) {
  const { file, zoom, x, y } = crop;
  if (!/^image\/(?:jpeg|png|webp)$/.test(file.type)) throw new Error("Choose a JPEG, PNG, or WebP image.");
  const source = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot process the picture.");
  const geometry = cropGeometry(source.width, source.height, 256, zoom, x, y);
  context.drawImage(source, geometry.left, geometry.top, geometry.width, geometry.height);
  source.close();
  const mimeType = "image/jpeg";
  const dataUrl = canvas.toDataURL(mimeType, 0.86);
  return { mimeType, data: dataUrl.slice(dataUrl.indexOf(",") + 1) };
}

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
    resetDemoData,
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
  const [motionThresholdDraft, setMotionThresholdDraft] = useState<string | null>(null);
  const [technicalTemplateDraft, setTechnicalTemplateDraft] = useState(() => profilePreferences.technicalLogTemplate.join("\n"));
  const [isResettingDemo, setIsResettingDemo] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isRemovingAvatar, setIsRemovingAvatar] = useState(false);
  const [avatarCrop, setAvatarCrop] = useState<AvatarCrop | null>(null);
  const motionThresholdValue = motionThresholdDraft ?? formatDecimalPreference(profilePreferences.motionStationaryThresholdNm);

  useEffect(() => { setTechnicalTemplateDraft(profilePreferences.technicalLogTemplate.join("\n")); }, [profilePreferences.technicalLogTemplate]);

  const technicalTemplateLines = () => technicalTemplateDraft.split("\n").map((line) => line.trim()).filter(Boolean);

  function commitMotionThresholdDraft() {
    if (motionThresholdDraft === null) return;
    const nextThreshold = parseDecimalPreference(motionThresholdDraft, profilePreferences.motionStationaryThresholdNm);
    setMotionThresholdDraft(null);
    updateViewPreferences({ motionStationaryThresholdNm: nextThreshold });
  }
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
  const avatar = props.avatar as string | undefined;
  const setAvatar = props.setAvatar as Dispatch<SetStateAction<string | undefined>>;
  const hasUploadedAvatar = props.hasUploadedAvatar as boolean;
  const setHasUploadedAvatar = props.setHasUploadedAvatar as Dispatch<SetStateAction<boolean>>;

  const avatarCropUrl = avatarCrop?.url;
  useEffect(() => () => {
    if (avatarCropUrl) URL.revokeObjectURL(avatarCropUrl);
  }, [avatarCropUrl]);

  async function chooseAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!/^image\/(?:jpeg|png|webp)$/.test(file.type)) {
      window.alert(t("profile.avatarUploadError"));
      return;
    }
    const bitmap = await createImageBitmap(file).catch(() => undefined);
    if (!bitmap) {
      window.alert(t("profile.avatarUploadError"));
      return;
    }
    const nextCrop = { file, url: URL.createObjectURL(file), width: bitmap.width, height: bitmap.height, zoom: 1, x: 0, y: 0 };
    bitmap.close();
    setAvatarCrop(nextCrop);
  }

  function closeAvatarCrop() {
    setAvatarCrop(null);
  }

  async function uploadAvatar() {
    if (!avatarCrop) return;
    setIsUploadingAvatar(true);
    try {
      const cropped = await cropImageToSquare(avatarCrop);
      const response = await fetch("/api/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "avatar", avatarData: cropped.data, avatarMimeType: cropped.mimeType }) });
      const payload = await response.json() as { avatar?: string; error?: string };
      if (!response.ok || !payload.avatar) throw new Error(payload.error ?? t("profile.avatarUploadError"));
      setAvatar(payload.avatar);
      setHasUploadedAvatar(true);
      closeAvatarCrop();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : t("profile.avatarUploadError"));
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  async function removeAvatar() {
    if (!window.confirm(t("profile.avatarRemoveConfirm"))) return;
    setIsRemovingAvatar(true);
    try {
      const response = await fetch("/api/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "avatar-remove" }) });
      const payload = await response.json() as { avatar?: string; error?: string };
      if (!response.ok) throw new Error(payload.error ?? t("profile.avatarRemoveError"));
      setAvatar(payload.avatar);
      setHasUploadedAvatar(false);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : t("profile.avatarRemoveError"));
    } finally {
      setIsRemovingAvatar(false);
    }
  }
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
      {avatarCrop && (() => {
        const preview = cropGeometry(avatarCrop.width, avatarCrop.height, 288, avatarCrop.zoom, avatarCrop.x, avatarCrop.y);
        return <div className="avatar-crop-backdrop" role="presentation">
          <section className="avatar-crop-dialog" role="dialog" aria-modal="true" aria-labelledby="avatar-crop-title">
            <header><h2 id="avatar-crop-title">{t("profile.cropTitle")}</h2><button type="button" onClick={closeAvatarCrop} aria-label={t("profile.cropCancel")}>×</button></header>
            <div className="avatar-crop-content">
              <div className="avatar-crop-preview"><Image unoptimized src={avatarCrop.url} alt="" width={avatarCrop.width} height={avatarCrop.height} style={{ width: preview.width, height: preview.height, left: preview.left, top: preview.top }} /></div>
              <div className="avatar-crop-controls">
                <label>{t("profile.cropZoom")}<input type="range" min="1" max="3" step="0.01" value={avatarCrop.zoom} onChange={(event) => setAvatarCrop({ ...avatarCrop, zoom: Number(event.target.value) })} /></label>
                <label>{t("profile.cropHorizontal")}<input type="range" min="-100" max="100" value={avatarCrop.x} onChange={(event) => setAvatarCrop({ ...avatarCrop, x: Number(event.target.value) })} /></label>
                <label>{t("profile.cropVertical")}<input type="range" min="-100" max="100" value={avatarCrop.y} onChange={(event) => setAvatarCrop({ ...avatarCrop, y: Number(event.target.value) })} /></label>
              </div>
            </div>
            <footer><button className="secondary-action" type="button" onClick={closeAvatarCrop}>{t("profile.cropCancel")}</button><button className="primary-action" type="button" onClick={uploadAvatar} disabled={isUploadingAvatar}>{isUploadingAvatar ? t("profile.cropSaving") : t("profile.cropSave")}</button></footer>
          </section>
        </div>;
      })()}
      <div className="page-heading">
        <div>
          <h1>{t("profile.title")}</h1>
          <p>{t("profile.subtitle")}</p>
        </div>
        <button className="secondary-action" type="button" onClick={logout} disabled={isLoggingOut}>
          {isLoggingOut ? t("nav.signingOut") : t("nav.logout")}
        </button>
      </div>
      <section className="profile-grid">
        <article className="profile-hero-card">
          <label className="profile-avatar profile-avatar-upload" title={t("profile.avatarUpload")}>
            {avatar ? <Image unoptimized src={avatar} alt={t("profile.avatarAlt")} width={64} height={64} /> : "ME"}
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseAvatar} disabled={isUploadingAvatar} />
            <span>{isUploadingAvatar ? "…" : "＋"}</span>
          </label>
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
            {hasUploadedAvatar && <button type="button" className="avatar-remove-action" onClick={removeAvatar} disabled={isRemovingAvatar}>{isRemovingAvatar ? t("profile.avatarRemoving") : t("profile.avatarRemove")}</button>}
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
        {userGroups.includes("demo") && (
          <article className="info-card inline-edit-grid">
            <h3>{t("profile.demoResetTitle")}</h3>
            <p className="wide-field">{t("profile.demoResetHelp")}</p>
            <div className="inline-edit-actions">
              <button
                type="button"
                className="ghost-button"
                disabled={isResettingDemo}
                onClick={async () => {
                  if (!window.confirm(t("profile.demoResetConfirm"))) return;
                  setIsResettingDemo(true);
                  await resetDemoData();
                  setIsResettingDemo(false);
                }}
              >
                {isResettingDemo ? t("profile.demoResetting") : t("profile.demoResetAction")}
              </button>
            </div>
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
            updateViewPreferences({ ...profilePreferences, technicalLogTemplate: technicalTemplateLines() });
          }}
        >
          <h3>{t("profile.preferences")}</h3>
          <fieldset className="preference-group wide-field">
            <legend>{t("profile.regionSettings")}</legend>
            <div className="preference-group-grid">
              <CountryFlagSelector
                  id="profile-country-code"
                  mode="iso-code"
                  label={t("profile.countryCode")}
                  emptyLabel={t("profile.countryNotSelected")}
                  value={profilePreferences.countryCode}
                  onChange={(countryCode) => updateViewPreferences({ countryCode })}
                />
              <label>
                {t("profile.language")}
                <select value={profilePreferences.language} onChange={(event) => updateViewPreferences({ language: event.target.value as ProfilePreferences["language"] })}>
                  {locales.map((locale) => <option key={locale} value={locale}>{localeLabels[locale]}</option>)}
                </select>
              </label>
              <label>
                {t("profile.dateFormat")}
                <select value={profilePreferences.dateFormat} onChange={(event) => updateViewPreferences({ dateFormat: event.target.value as ProfilePreferences["dateFormat"] })}>
                  {dateFormats.map((format) => <option key={format} value={format}>{formatStoredDate("2026-08-07", format, profilePreferences.language)} ({format})</option>)}
                </select>
              </label>
              <label>
                {t("profile.timeFormat")}
                <select value={profilePreferences.timeFormat} onChange={(event) => updateViewPreferences({ timeFormat: event.target.value as ProfilePreferences["timeFormat"] })}>
                  {timeFormats.map((format) => <option key={format} value={format}>{formatStoredTime("2026-08-07T19:05:09+00:00", format)} ({format})</option>)}
                </select>
              </label>
              <small className="field-hint">{t("profile.nativePickerHint")}</small>
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
                  {logbook.boats.filter((boat) => !boat.archived).map((boat) => <option key={boat.id} value={boat.id}>{boat.name}</option>)}
                </select>
              </label>
              <label>
                {t("profile.defaultCrewMembers")}
                <select multiple value={profilePreferences.defaultCrewMemberIds} onChange={(event) => updateViewPreferences({ defaultCrewMemberIds: Array.from(event.target.selectedOptions, (option) => option.value) })}>
                  {logbook.crewMembers.map((crew) => <option key={crew.id} value={crew.id}>{crew.name}</option>)}
                </select>
              </label>
              <label>
                {t("profile.motionStationaryThresholdNm")}
                <input
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*[.]?[0-9]*"
                  value={motionThresholdValue}
                  onChange={(event) => {
                    const nextValue = event.target.value.replace(",", ".");
                    if (/^\d*(?:\.\d*)?$/.test(nextValue)) setMotionThresholdDraft(nextValue);
                  }}
                  onBlur={commitMotionThresholdDraft}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.currentTarget.blur();
                  }}
                />
              </label>
            </div>
          </fieldset>
          <fieldset className="preference-group wide-field">
            <legend>{t("profile.technicalLogTemplate")}</legend>
            <p><strong>{t("profile.standardTechnicalChecks")}</strong></p>
            <div className="technical-template-options">{standardTechnicalLogTemplate(profilePreferences.language).map(({ id, text }) => (
              <label key={id}><input type="checkbox" checked={profilePreferences.enabledStandardTechnicalChecks.includes(id)} onChange={(event) => {
                const enabled = event.target.checked ? [...profilePreferences.enabledStandardTechnicalChecks, id] : profilePreferences.enabledStandardTechnicalChecks.filter((candidate) => candidate !== id);
                updateViewPreferences({ enabledStandardTechnicalChecks: STANDARD_TECHNICAL_CHECK_IDS.filter((candidate) => enabled.includes(candidate)) as StandardTechnicalCheckId[] });
              }} />⌛ {text}</label>
            ))}</div>
            <label>
              {t("profile.additionalTechnicalChecks")}
              <textarea rows={6} value={technicalTemplateDraft} onChange={(event) => setTechnicalTemplateDraft(event.target.value)} onBlur={() => updateViewPreferences({ technicalLogTemplate: technicalTemplateLines() })} />
              <small>{t("profile.technicalLogTemplateHelp")}</small>
            </label>
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
                {t("profile.defaultPageSize")}
                <select value={profilePreferences.defaultPageSize} onChange={(event) => updateViewPreferences({ defaultPageSize: normalizePageSize(Number(event.target.value), profilePreferences.defaultPageSize) })}>
                  {pageSizeOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label>
                {t("profile.showCourseConversionTable")}
                <select value={profilePreferences.showCourseConversionTable ? "yes" : "no"} onChange={(event) => updateViewPreferences({ showCourseConversionTable: event.target.value === "yes" })}>
                  <option value="yes">{t("common.yes")}</option>
                  <option value="no">{t("common.no")}</option>
                </select>
              </label>
              <label>
                {t("profile.showAvatarOnPrint")}
                <select value={profilePreferences.showAvatarOnPrint ? "yes" : "no"} onChange={(event) => updateViewPreferences({ showAvatarOnPrint: event.target.value === "yes" })}>
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

function formatDecimalPreference(value: number) {
  return Number.isFinite(value) ? String(value) : "0.1";
}

function parseDecimalPreference(value: string, fallback: number) {
  const normalizedValue = value.trim().replace(",", ".");
  if (normalizedValue === "") return fallback;
  const parsedValue = Number(normalizedValue);
  return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : fallback;
}

import { useEffect, useMemo, useState } from "react";
import type { ActiveView } from "../../templates/ModuleTabs";
import type { PersistedLogbook } from "../../models/logbook";
import { detectOnboardingCompletion } from "../../lib/onboarding/detect";
import type { OnboardingTaskId } from "../../lib/onboarding/tasks";
import type { Locale } from "../../lib/i18n";

export type ProfilePreferences = {
  countryCode: string;
  language: Locale;
  windUnit: "bft" | "kn" | "km/h" | "mp/h" | "m/s";
  waterHeightUnit: "m" | "ft";
  temperatureUnit: "°C" | "°F";
  coordinateFormat: "decimal" | "dms";
  distanceDisplayUnit: "off" | "m" | "km";
  defaultBoatId: string;
  defaultCrewMemberIds: string[];
  theme: "light" | "dark" | "auto";
  isNavSlim: boolean;
  showCourseConversionTable: boolean;
  showAvatarOnPrint: boolean;
  defaultPageSize: 5 | 10 | 25 | 50 | 100;
  motionStationaryThresholdNm: number;
};

const defaultPreferences: ProfilePreferences = {
  countryCode: "",
  language: "en",
  windUnit: "bft",
  waterHeightUnit: "m",
  temperatureUnit: "°C",
  coordinateFormat: "decimal",
  distanceDisplayUnit: "off",
  defaultBoatId: "",
  defaultCrewMemberIds: [],
  theme: "light",
  isNavSlim: false,
  showCourseConversionTable: true,
  showAvatarOnPrint: true,
  defaultPageSize: 10,
  motionStationaryThresholdNm: 0.1,
};

export type ProfileApiPreferences = Partial<ProfilePreferences> & {
  theme?: ProfilePreferences["theme"];
  isNavSlim?: boolean;
};

export type ProfilePayload = {
  avatar?: string;
  hasUploadedAvatar?: boolean;
  name?: string;
  email?: string;
  emailVerified?: boolean;
  groups?: string[];
  onboardingCompletedTasks?: OnboardingTaskId[];
  preferences?: ProfileApiPreferences;
  theme?: ProfilePreferences["theme"];
  isNavSlim?: boolean;
  hasReadCompliance?: boolean;
  error?: string;
};

type UseOnboardingProfileOptions = {
  activeModule: ActiveView;
  initialEmail?: string;
  initialName?: string;
  logbook: PersistedLogbook;
  onProfileError: (message: string) => void;
  onProfileMessage?: (message: string) => void;
  onLocaleChange?: (locale: Locale) => void;
  onCourseConversionPreferenceChange?: (show: boolean) => void;
  t: (key: "profile.unableUpdateOnboarding" | "profile.unableUpdatePreferences" | "profile.preferencesUpdated") => string;
};

function mergePreferences(current: ProfilePreferences, next?: ProfileApiPreferences): ProfilePreferences {
  return {
    ...current,
    ...next,
    language: next?.language ?? current.language,
    defaultCrewMemberIds: Array.isArray(next?.defaultCrewMemberIds) ? next.defaultCrewMemberIds : current.defaultCrewMemberIds,
    defaultPageSize: [5, 10, 25, 50, 100].includes(next?.defaultPageSize ?? current.defaultPageSize) ? (next?.defaultPageSize ?? current.defaultPageSize) : current.defaultPageSize,
    motionStationaryThresholdNm: normalizeMotionThreshold(next?.motionStationaryThresholdNm, current.motionStationaryThresholdNm),
  };
}

function normalizeMotionThreshold(value: unknown, fallback: number) {
  if (value === undefined || value === null || value === "") return fallback;
  const threshold = Number(value);
  return Number.isFinite(threshold) && threshold >= 0 ? threshold : fallback;
}

function preferencesFromPayload(payload: ProfilePayload, fallback: ProfilePreferences): ProfilePreferences {
  return mergePreferences(fallback, {
    ...payload.preferences,
    theme: payload.theme ?? payload.preferences?.theme,
    isNavSlim: payload.isNavSlim ?? payload.preferences?.isNavSlim,
  });
}

export function useOnboardingProfile({ activeModule, initialEmail, initialName, logbook, onProfileError, onProfileMessage, onLocaleChange, onCourseConversionPreferenceChange, t }: UseOnboardingProfileOptions) {
  const [accountName, setAccountName] = useState(initialName ?? "");
  const [accountEmail, setAccountEmail] = useState(initialEmail ?? "");
  const [profileAvatar, setProfileAvatar] = useState<string | undefined>();
  const [hasUploadedAvatar, setHasUploadedAvatar] = useState(false);
  const [isAccountEmailVerified, setIsAccountEmailVerified] = useState(false);
  const [preferences, setPreferences] = useState<ProfilePreferences>(defaultPreferences);
  const [onboardingCompletedTasks, setOnboardingCompletedTasks] = useState<OnboardingTaskId[]>([]);
  const [isSavingOnboarding, setIsSavingOnboarding] = useState(false);
  const [hasReadCompliance, setHasReadCompliance] = useState(false);

  const theme = preferences.theme;
  const isNavSlim = preferences.isNavSlim;

  const onboardingCompletion = useMemo(() => detectOnboardingCompletion({
    logbook,
    manualCompletedTasks: onboardingCompletedTasks,
    hasPersonalizedView: theme !== "light" || isNavSlim,
    hasReadCompliance,
    hasVerifiedEmail: isAccountEmailVerified,
  }), [hasReadCompliance, isAccountEmailVerified, isNavSlim, logbook, onboardingCompletedTasks, theme]);

  const isOnboardingComplete = Object.values(onboardingCompletion).every((task) => task.completed);

  useEffect(() => {
    let isMounted = true;
    async function loadProfile() {
      const response = await fetch("/api/profile").catch(() => undefined);
      if (!response?.ok) return;
      const payload = await response.json().catch(() => ({})) as ProfilePayload;
      if (!isMounted) return;
      if (payload.name) setAccountName(payload.name);
      if (payload.email) setAccountEmail(payload.email);
      if (payload.avatar) setProfileAvatar(payload.avatar);
      if (typeof payload.hasUploadedAvatar === "boolean") setHasUploadedAvatar(payload.hasUploadedAvatar);
      if (typeof payload.emailVerified === "boolean") setIsAccountEmailVerified(payload.emailVerified);
      if (Array.isArray(payload.onboardingCompletedTasks)) setOnboardingCompletedTasks(payload.onboardingCompletedTasks);
      const nextPreferences = preferencesFromPayload(payload, defaultPreferences);
      setPreferences(nextPreferences);
      onCourseConversionPreferenceChange?.(nextPreferences.showCourseConversionTable);
      if (payload.preferences?.language) onLocaleChange?.(payload.preferences.language);
      if (typeof payload.hasReadCompliance === "boolean") setHasReadCompliance(payload.hasReadCompliance);
    }
    loadProfile();
    return () => {
      isMounted = false;
    };
  }, [onCourseConversionPreferenceChange, onLocaleChange]);

  useEffect(() => {
    if (activeModule !== "compliance" || hasReadCompliance) return;
    let isMounted = true;
    async function markComplianceRead() {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "compliance-read" }),
      }).catch(() => undefined);
      if (!response?.ok) return;
      const payload = await response.json().catch(() => ({})) as ProfilePayload;
      if (isMounted && typeof payload.hasReadCompliance === "boolean") setHasReadCompliance(payload.hasReadCompliance);
    }
    markComplianceRead();
    return () => {
      isMounted = false;
    };
  }, [activeModule, hasReadCompliance]);

  async function updatePreferences(nextPreferences: Partial<ProfilePreferences>) {
    const previousPreferences = preferences;
    const mergedPreferences = mergePreferences(preferences, nextPreferences);
    setPreferences(mergedPreferences);
    onProfileError("");
    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "preferences", preferences: nextPreferences }),
    });
    const payload = await response.json().catch(() => ({})) as ProfilePayload;
    if (!response.ok) {
      setPreferences(previousPreferences);
      onProfileError(payload.error ?? t("profile.unableUpdatePreferences"));
      return;
    }
    const savedPreferences = preferencesFromPayload(payload, mergedPreferences);
    setPreferences(savedPreferences);
    onLocaleChange?.(savedPreferences.language);
    onCourseConversionPreferenceChange?.(savedPreferences.showCourseConversionTable);
    onProfileMessage?.(t("profile.preferencesUpdated"));
  }

  async function updateOnboardingCompletedTasks(nextTasks: OnboardingTaskId[]) {
    const previousTasks = onboardingCompletedTasks;
    setOnboardingCompletedTasks(nextTasks);
    setIsSavingOnboarding(true);
    onProfileError("");
    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "onboarding", onboardingCompletedTasks: nextTasks }),
    });
    const payload = await response.json().catch(() => ({})) as ProfilePayload;
    setIsSavingOnboarding(false);
    if (!response.ok) {
      setOnboardingCompletedTasks(previousTasks);
      onProfileError(payload.error ?? t("profile.unableUpdateOnboarding"));
      return;
    }
    setOnboardingCompletedTasks(payload.onboardingCompletedTasks ?? nextTasks);
  }

  return {
    accountEmail,
    accountName,
    isNavSlim,
    isAccountEmailVerified,
    isOnboardingComplete,
    isSavingOnboarding,
    onboardingCompletedTasks,
    onboardingCompletion,
    preferences,
    profileAvatar,
    hasUploadedAvatar,
    setAccountEmail,
    setIsAccountEmailVerified,
    setAccountName,
    setProfileAvatar,
    setHasUploadedAvatar,
    theme,
    updateOnboardingCompletedTasks,
    updatePreferences,
    updateViewPreferences: updatePreferences,
  };
}

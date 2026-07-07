import { useEffect, useMemo, useState } from "react";
import type { ActiveView } from "../../templates/ModuleTabs";
import type { PersistedLogbook } from "../../models/logbook";
import { detectOnboardingCompletion } from "../../lib/onboarding/detect";
import type { OnboardingTaskId } from "../../lib/onboarding/tasks";

export type ProfilePayload = {
  name?: string;
  email?: string;
  groups?: string[];
  onboardingCompletedTasks?: OnboardingTaskId[];
  theme?: "light" | "dark";
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
  t: (key: "profile.unableUpdateOnboarding" | "profile.unableUpdatePreferences") => string;
};

export function useOnboardingProfile({ activeModule, initialEmail, initialName, logbook, onProfileError, t }: UseOnboardingProfileOptions) {
  const [accountName, setAccountName] = useState(initialName ?? "");
  const [accountEmail, setAccountEmail] = useState(initialEmail ?? "");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [isNavSlim, setIsNavSlim] = useState(false);
  const [onboardingCompletedTasks, setOnboardingCompletedTasks] = useState<OnboardingTaskId[]>([]);
  const [isSavingOnboarding, setIsSavingOnboarding] = useState(false);
  const [hasReadCompliance, setHasReadCompliance] = useState(false);

  const onboardingCompletion = useMemo(() => detectOnboardingCompletion({
    logbook,
    manualCompletedTasks: onboardingCompletedTasks,
    hasPersonalizedView: theme !== "light" || isNavSlim,
    hasReadCompliance,
  }), [hasReadCompliance, isNavSlim, logbook, onboardingCompletedTasks, theme]);

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
      if (Array.isArray(payload.onboardingCompletedTasks)) setOnboardingCompletedTasks(payload.onboardingCompletedTasks);
      if (payload.theme === "light" || payload.theme === "dark") setTheme(payload.theme);
      if (typeof payload.isNavSlim === "boolean") setIsNavSlim(payload.isNavSlim);
      if (typeof payload.hasReadCompliance === "boolean") setHasReadCompliance(payload.hasReadCompliance);
    }
    loadProfile();
    return () => {
      isMounted = false;
    };
  }, []);

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

  async function updateViewPreferences(nextPreferences: { theme?: "light" | "dark"; isNavSlim?: boolean }) {
    const previousTheme = theme;
    const previousIsNavSlim = isNavSlim;
    const nextTheme = nextPreferences.theme ?? theme;
    const nextIsNavSlim = nextPreferences.isNavSlim ?? isNavSlim;
    setTheme(nextTheme);
    setIsNavSlim(nextIsNavSlim);
    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "preferences", theme: nextTheme, isNavSlim: nextIsNavSlim }),
    });
    const payload = await response.json().catch(() => ({})) as ProfilePayload;
    if (!response.ok) {
      setTheme(previousTheme);
      setIsNavSlim(previousIsNavSlim);
      onProfileError(payload.error ?? t("profile.unableUpdatePreferences"));
      return;
    }
    if (payload.theme === "light" || payload.theme === "dark") setTheme(payload.theme);
    if (typeof payload.isNavSlim === "boolean") setIsNavSlim(payload.isNavSlim);
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
    isOnboardingComplete,
    isSavingOnboarding,
    onboardingCompletedTasks,
    onboardingCompletion,
    setAccountEmail,
    setAccountName,
    theme,
    updateOnboardingCompletedTasks,
    updateViewPreferences,
  };
}

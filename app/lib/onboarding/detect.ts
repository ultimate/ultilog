import type { PersistedLogbook } from "../../models/logbook";
import { isOnboardingTaskId, onboardingTaskIds, type OnboardingTaskId } from "./tasks";

export type OnboardingTaskCompletion = {
  manuallyCompleted: boolean;
  automaticallyCompleted: boolean;
  completed: boolean;
};

export type OnboardingCompletionState = Record<OnboardingTaskId, OnboardingTaskCompletion>;

export type OnboardingDetectionInput = {
  logbook: PersistedLogbook;
  manualCompletedTasks?: unknown;
  hasPersonalizedView?: boolean;
  hasReadCompliance?: boolean;
  hasVerifiedEmail?: boolean;
};

export function detectOnboardingCompletion(input: OnboardingDetectionInput): OnboardingCompletionState {
  const manuallyCompletedTasks = new Set(normalizeOnboardingTaskIds(input.manualCompletedTasks));
  const automaticallyCompletedTasks = new Set(detectAutomaticOnboardingTaskIds(input));

  return Object.fromEntries(onboardingTaskIds.map((id) => [
    id,
    {
      manuallyCompleted: manuallyCompletedTasks.has(id),
      automaticallyCompleted: automaticallyCompletedTasks.has(id),
      completed: manuallyCompletedTasks.has(id) || automaticallyCompletedTasks.has(id),
    },
  ])) as OnboardingCompletionState;
}

export function completedOnboardingTaskIds(state: OnboardingCompletionState): OnboardingTaskId[] {
  return onboardingTaskIds.filter((id) => state[id].completed);
}

function detectAutomaticOnboardingTaskIds(input: OnboardingDetectionInput): OnboardingTaskId[] {
  const completed: OnboardingTaskId[] = [];
  if (input.hasVerifiedEmail) completed.push("verify_email");
  if (input.hasReadCompliance) completed.push("read_compliance");
  if (hasCompletedPrimaryCrew(input.logbook)) completed.push("complete_primary_crew");
  if (input.hasPersonalizedView) completed.push("personalize_view");
  if (input.logbook.boats.length > 0) completed.push("create_first_boat");
  if (input.logbook.sheets.length > 0) completed.push("create_first_logsheet");
  return completed;
}

function normalizeOnboardingTaskIds(value: unknown): OnboardingTaskId[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(isOnboardingTaskId))];
}

function hasCompletedPrimaryCrew(logbook: PersistedLogbook) {
  const primaryCrew = logbook.crewMembers.find((member) => member.isPrimary) ?? logbook.crewMembers.find((member) => member.id === "me");
  if (!primaryCrew) return false;
  return [primaryCrew.name, primaryCrew.nationality, primaryCrew.role, primaryCrew.address, primaryCrew.certificate].every(hasUserProvidedValue);
}

function hasUserProvidedValue(value: string | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

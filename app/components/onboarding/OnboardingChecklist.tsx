import { useI18n } from "../../lib/i18n";
import type { OnboardingCompletionState } from "../../lib/onboarding/detect";
import { completedOnboardingTaskIds } from "../../lib/onboarding/detect";
import { onboardingTasks, type OnboardingTaskId } from "../../lib/onboarding/tasks";

export type OnboardingChecklistProps = {
  completion: OnboardingCompletionState;
  manualCompletedTasks: OnboardingTaskId[];
  onManualCompletedTasksChange: (tasks: OnboardingTaskId[]) => void;
  onOpenTask?: (taskId: OnboardingTaskId) => void;
  isSaving?: boolean;
  compact?: boolean;
};

export function OnboardingChecklist({ completion, manualCompletedTasks, onManualCompletedTasksChange, onOpenTask, isSaving = false, compact = false }: OnboardingChecklistProps) {
  const { t } = useI18n();
  const completedCount = completedOnboardingTaskIds(completion).length;
  const totalCount = onboardingTasks.length;
  const isComplete = completedCount === totalCount;

  function toggleManualTask(taskId: OnboardingTaskId, checked: boolean) {
    const nextTasks = checked
      ? [...new Set([...manualCompletedTasks, taskId])]
      : manualCompletedTasks.filter((id) => id !== taskId);
    onManualCompletedTasksChange(nextTasks);
  }

  return (
    <article className={`onboarding-card info-card ${compact ? "compact" : ""}`} aria-label={t("onboarding.checklistAria")}>
      <div className="onboarding-heading">
        <div>
          <p className="eyebrow">{t("onboarding.eyebrow")}</p>
          <h3>{t("onboarding.checklistTitle")}</h3>
          <p>{t(isComplete ? "onboarding.allDone" : "onboarding.checklistSubtitle")}</p>
        </div>
        <strong className="onboarding-progress">{completedCount}/{totalCount}</strong>
      </div>
      <ul className="onboarding-task-list">
        {onboardingTasks.map((task) => {
          const state = completion[task.id];
          const isManuallyChecked = manualCompletedTasks.includes(task.id);
          return (
            <li key={task.id} className={state.completed ? "complete" : ""}>
              <label>
                <input
                  type="checkbox"
                  checked={state.automaticallyCompleted || isManuallyChecked}
                  disabled={isSaving || state.automaticallyCompleted}
                  onChange={(event) => toggleManualTask(task.id, event.target.checked)}
                />
                <span>
                  <strong>{t(task.titleKey)}</strong>
                  <small>{t(task.descriptionKey)}</small>
                  {state.automaticallyCompleted && <em>{t("onboarding.detectedAutomatically")}</em>}
                </span>
              </label>
              {onOpenTask && (
                <button type="button" className="ghost-button" onClick={() => onOpenTask(task.id)}>
                  {t("common.open")}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </article>
  );
}

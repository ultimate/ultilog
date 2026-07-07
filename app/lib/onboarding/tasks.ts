import type { TranslationKey } from "../i18n/translations";

export const onboardingTaskIds = [
  "read_compliance",
  "complete_primary_crew",
  "personalize_view",
  "create_first_boat",
  "create_first_logsheet",
] as const;

export type OnboardingTaskId = (typeof onboardingTaskIds)[number];

export type OnboardingTask = {
  id: OnboardingTaskId;
  titleKey: TranslationKey;
  descriptionKey: TranslationKey;
};

export const onboardingTasks = [
  {
    id: "read_compliance",
    titleKey: "onboarding.readCompliance.title",
    descriptionKey: "onboarding.readCompliance.description",
  },
  {
    id: "complete_primary_crew",
    titleKey: "onboarding.completePrimaryCrew.title",
    descriptionKey: "onboarding.completePrimaryCrew.description",
  },
  {
    id: "personalize_view",
    titleKey: "onboarding.personalizeView.title",
    descriptionKey: "onboarding.personalizeView.description",
  },
  {
    id: "create_first_boat",
    titleKey: "onboarding.createFirstBoat.title",
    descriptionKey: "onboarding.createFirstBoat.description",
  },
  {
    id: "create_first_logsheet",
    titleKey: "onboarding.createFirstLogsheet.title",
    descriptionKey: "onboarding.createFirstLogsheet.description",
  },
] as const satisfies readonly OnboardingTask[];

import type { LogSheetSharePrivacy, LogSheetShareSettings } from "../../models/logbook";

export type SectionVisibility = Record<keyof LogSheetShareSettings, boolean>;

export const copyRequiredSections = ["masterData", "logLines", "technicalLog"] as const;
export type CopyRequiredSection = (typeof copyRequiredSections)[number];

export type SharedSheetCapability = {
  canCopy: boolean;
  missingRequiredSections: CopyRequiredSection[];
  requiresAuthentication: boolean;
};

export function sectionVisibility(share: LogSheetShareSettings, isAuthenticated: boolean): SectionVisibility {
  return {
    masterData: canViewSection(share.masterData, isAuthenticated),
    picture: canViewSection(share.picture, isAuthenticated),
    logLines: canViewSection(share.logLines, isAuthenticated),
    metrics: canViewSection(share.metrics, isAuthenticated),
    technicalLog: canViewSection(share.technicalLog, isAuthenticated),
    skipper: canViewSection(share.skipper, isAuthenticated),
    crew: canViewSection(share.crew, isAuthenticated),
  };
}

export function sharedSheetCapability(share: LogSheetShareSettings, isAuthenticated: boolean): SharedSheetCapability {
  const visibility = sectionVisibility(share, isAuthenticated);
  const missingRequiredSections = copyRequiredSections.filter(section => !visibility[section]);
  const requiresAuthentication = !isAuthenticated
    && missingRequiredSections.length > 0
    && missingRequiredSections.every(section => share[section] === "registered");
  return {
    canCopy: missingRequiredSections.length === 0,
    missingRequiredSections,
    requiresAuthentication,
  };
}

function canViewSection(privacy: LogSheetSharePrivacy, isAuthenticated: boolean) {
  return privacy === "public" || (privacy === "registered" && isAuthenticated);
}

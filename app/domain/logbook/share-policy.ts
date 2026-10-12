import type { LogSheetSharePrivacy, LogSheetShareSettings } from "../../models/logbook";

export type SectionVisibility = Record<keyof LogSheetShareSettings, boolean>;

export const copyRequiredSections = ["masterData", "logLines", "technicalLog"] as const;
export type CopyRequiredSection = (typeof copyRequiredSections)[number];

export type SharedSheetCapability = {
  canCopy: boolean;
  missingRequiredSections: CopyRequiredSection[];
  requiresAuthentication: boolean;
};

const privacyLevel: Record<LogSheetSharePrivacy, number> = {
  private: 0,
  registered: 1,
  public: 2,
};

/** The skipper is the first crew member, so they cannot be less visible than the rest of the crew. */
export function isSkipperSharingSufficient(share: Pick<LogSheetShareSettings, "skipper" | "crew">) {
  return privacyLevel[share.skipper] >= privacyLevel[share.crew];
}

/** Raises skipper visibility when necessary without reducing any existing sharing choice. */
export function enforceSkipperSharing(share: LogSheetShareSettings): LogSheetShareSettings {
  return isSkipperSharingSufficient(share) ? share : { ...share, skipper: share.crew };
}

/** Master data sets the maximum audience for every other section. */
export function isMasterDataSharingSufficient(share: LogSheetShareSettings) {
  return Object.values(share).every(privacy => isPrivacyAtLeast(share.masterData, privacy));
}

/** Reduces dependent visibility without broadening master data access. */
export function enforceMasterDataSharing(share: LogSheetShareSettings): LogSheetShareSettings {
  return Object.fromEntries(Object.entries(share).map(([section, privacy]) => [
    section, isPrivacyAtLeast(share.masterData, privacy) ? privacy : share.masterData,
  ])) as LogSheetShareSettings;
}

/** Older exports tied remarks to master data and allowed independent section audiences. */
export function normalizeLegacySharing(share: Omit<LogSheetShareSettings, "remarks"> & { remarks?: LogSheetSharePrivacy }): LogSheetShareSettings {
  return enforceMasterDataSharing({ ...share, remarks: share.remarks ?? share.masterData });
}

export function isPrivacyAtLeast(privacy: LogSheetSharePrivacy, minimum: LogSheetSharePrivacy) {
  return privacyLevel[privacy] >= privacyLevel[minimum];
}

export function sectionVisibility(share: LogSheetShareSettings, isAuthenticated: boolean): SectionVisibility {
  share = enforceMasterDataSharing(share);
  return {
    remarks: canViewSection(share.remarks, isAuthenticated),
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
  share = enforceMasterDataSharing(share);
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

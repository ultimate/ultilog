import { describe, expect, it } from "vitest";
import { copyRequiredSections, sectionVisibility, sharedSheetCapability } from "../../../../app/domain/logbook/share-policy";
import type { LogSheetSharePrivacy, LogSheetShareSettings } from "../../../../app/models/logbook";

function sharing(required: LogSheetSharePrivacy, overrides: Partial<LogSheetShareSettings> = {}): LogSheetShareSettings {
  return {
    masterData: required,
    logLines: required,
    technicalLog: required,
    picture: "private",
    metrics: "private",
    skipper: "private",
    crew: "private",
    ...overrides,
  };
}

describe("shared log sheet copy policy", () => {
  it("covers every sharing-settings combination for signed-out, owner, and foreign-user sessions", () => {
    const privacyLevels: LogSheetSharePrivacy[] = ["private", "registered", "public"];
    const sectionNames = ["masterData", "picture", "logLines", "metrics", "technicalLog", "skipper", "crew"] as const;
    const sessions = [
      { name: "signed-out", authenticated: false },
      { name: "source-owner", authenticated: true },
      { name: "foreign-user", authenticated: true },
    ] as const;
    let checked = 0;

    // Generate all 3^7 configurations rather than sampling a handful of presets.
    for (let encoded = 0; encoded < privacyLevels.length ** sectionNames.length; encoded += 1) {
      let cursor = encoded;
      const share = {} as LogSheetShareSettings;
      for (const section of sectionNames) {
        share[section] = privacyLevels[cursor % privacyLevels.length];
        cursor = Math.floor(cursor / privacyLevels.length);
      }

      for (const session of sessions) {
        const expectedVisibility = Object.fromEntries(sectionNames.map(section => [
          section,
          share[section] === "public" || (share[section] === "registered" && session.authenticated),
        ])) as Record<(typeof sectionNames)[number], boolean>;
        const missingRequiredSections = copyRequiredSections.filter(section => !expectedVisibility[section]);
        const capability = sharedSheetCapability(share, session.authenticated);

        expect(sectionVisibility(share, session.authenticated), `${session.name}: visibility for configuration ${encoded}`).toEqual(expectedVisibility);
        expect(capability, `${session.name}: capability for configuration ${encoded}`).toEqual({
          canCopy: missingRequiredSections.length === 0,
          missingRequiredSections,
          requiresAuthentication: !session.authenticated
            && missingRequiredSections.length > 0
            && missingRequiredSections.every(section => share[section] === "registered"),
        });
        checked += 1;
      }
    }

    expect(checked).toBe(privacyLevels.length ** sectionNames.length * sessions.length);
  });

  it("allows every viewer to copy when all required sections are public", () => {
    expect(sharedSheetCapability(sharing("public"), false)).toEqual({
      canCopy: true,
      missingRequiredSections: [],
      requiresAuthentication: false,
    });
  });

  it("allows registered required sections only for signed-in viewers", () => {
    expect(sharedSheetCapability(sharing("registered"), true)).toMatchObject({ canCopy: true, missingRequiredSections: [], requiresAuthentication: false });
    expect(sharedSheetCapability(sharing("registered"), false)).toEqual({
      canCopy: false,
      missingRequiredSections: ["masterData", "logLines", "technicalLog"],
      requiresAuthentication: true,
    });
  });

  it("reports only unavailable required sections for mixed privacy levels", () => {
    expect(sharedSheetCapability(sharing("public", { logLines: "registered", technicalLog: "private" }), false)).toEqual({
      canCopy: false,
      missingRequiredSections: ["logLines", "technicalLog"],
      requiresAuthentication: false,
    });
  });

  it("does not allow private required sections for authenticated viewers", () => {
    expect(sharedSheetCapability(sharing("public", { masterData: "private" }), true)).toMatchObject({
      canCopy: false,
      missingRequiredSections: ["masterData"],
      requiresAuthentication: false,
    });
  });

  it("does not require optional crew, skipper, picture, or metrics sections", () => {
    expect(sharedSheetCapability(sharing("public"), false).canCopy).toBe(true);
  });

  it("keeps empty-but-visible log lines and technical checks copyable because eligibility uses sharing configuration", () => {
    // The policy deliberately accepts no sheet collections, so collection contents cannot affect eligibility.
    expect(sharedSheetCapability(sharing("public"), false).canCopy).toBe(true);
  });
});

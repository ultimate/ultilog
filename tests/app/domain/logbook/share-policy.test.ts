import { describe, expect, it } from "vitest";
import { sharedSheetCapability } from "../../../../app/domain/logbook/share-policy";
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

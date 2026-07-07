import { describe, expect, it } from "vitest";
import { completedOnboardingTaskIds, detectOnboardingCompletion } from "../../../app/lib/onboarding/detect";
import type { PersistedLogbook } from "../../../app/models/logbook";

const emptyLogbook: PersistedLogbook = {
  boats: [],
  crewMembers: [],
  sheets: [],
};

describe("detectOnboardingCompletion", () => {
  it("marks manual completion independently from automatic detection", () => {
    const state = detectOnboardingCompletion({
      logbook: emptyLogbook,
      manualCompletedTasks: ["read_compliance", "unknown_task", "read_compliance"],
    });

    expect(state.read_compliance).toEqual({
      manuallyCompleted: true,
      automaticallyCompleted: false,
      completed: true,
    });
    expect(state.create_first_boat.completed).toBe(false);
    expect(completedOnboardingTaskIds(state)).toEqual(["read_compliance"]);
  });

  it("auto-detects boats, logsheets, primary crew details, and optional tracked profile flags", () => {
    const state = detectOnboardingCompletion({
      logbook: {
        boats: [{ id: "boat-1", name: "Aurora", type: "Sail", registration: "", flagState: "", homePort: "", owner: "", dimensions: "", yachtData: {}, deviationTable: [] }],
        crewMembers: [{ id: "me", name: "Skipper", nationality: "CH", role: "Skipper", address: "Harbor 1", certificate: "ICC", isPrimary: true }],
        sheets: [{ id: "sheet-1", title: "First trip", dateRange: "", status: "Draft", boatId: "boat-1", route: { from: "A", to: "B", departed: "", arrived: "" }, crew: [], watchPlan: [], technicalChecks: [], lines: [] }],
      },
      hasPersonalizedView: true,
      hasReadCompliance: true,
    });

    expect(completedOnboardingTaskIds(state)).toEqual([
      "read_compliance",
      "complete_primary_crew",
      "personalize_view",
      "create_first_boat",
      "create_first_logsheet",
    ]);
    expect(state.complete_primary_crew).toEqual({
      manuallyCompleted: false,
      automaticallyCompleted: true,
      completed: true,
    });
  });

  it("does not auto-complete primary crew while default blank fields remain", () => {
    const state = detectOnboardingCompletion({
      logbook: {
        ...emptyLogbook,
        crewMembers: [{ id: "me", name: "New User", nationality: "", role: "Owner", address: "", certificate: "", isPrimary: true }],
      },
    });

    expect(state.complete_primary_crew).toEqual({
      manuallyCompleted: false,
      automaticallyCompleted: false,
      completed: false,
    });
  });
});

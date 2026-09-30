import { describe, expect, it } from "vitest";
import { validateLogSheet } from "../../../app/lib/validation/log-sheet";

const baseSheet = {
  id: "sheet-1",
  title: "Passage",
  status: "Draft",
  boatId: "boat-1",
  route: { from: "A", to: "B", departed: "", arrived: "" },
  crew: [],
  technicalChecks: [],
  lines: [],
};

const baseShare = {
  masterData: "private",
  picture: "private",
  logLines: "private",
  metrics: "private",
  technicalLog: "private",
} as const;

describe("log sheet sharing validation", () => {
  it.each([
    ["private", "private"],
    ["registered", "private"],
    ["registered", "registered"],
    ["public", "registered"],
    ["public", "public"],
  ] as const)("accepts %s skipper sharing with %s crew sharing", (skipper, crew) => {
    expect(() => validateLogSheet({ ...baseSheet, share: { ...baseShare, skipper, crew } })).not.toThrow();
  });

  it.each([
    ["private", "registered"],
    ["private", "public"],
    ["registered", "public"],
  ] as const)("rejects %s skipper sharing with %s crew sharing", (skipper, crew) => {
    expect(() => validateLogSheet({ ...baseSheet, share: { ...baseShare, skipper, crew } }))
      .toThrow("share.skipper must be at least as visible as crew");
  });
});

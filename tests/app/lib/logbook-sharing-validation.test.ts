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
  masterData: "public",
  remarks: "private",
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
  it.each(["remarks", "picture", "logLines", "metrics", "technicalLog", "skipper", "crew"])("rejects %s sharing beyond the master data audience", section => {
    expect(() => validateLogSheet({ ...baseSheet, share: { ...baseShare, masterData: "registered", skipper: section === "crew" ? "public" : "private", crew: "private", [section]: "public" } }))
      .toThrow("share.masterData must be at least as visible as every other section");
  });

  it("rejects invalid remarks privacy", () => {
    expect(() => validateLogSheet({ ...baseSheet, share: { ...baseShare, skipper: "private", crew: "private", remarks: "invalid" } })).toThrow("share.remarks is malformed");
  });

  it("imports legacy sharing with remarks inheriting master data and caps other audiences", () => {
    const { remarks: _remarks, ...legacy } = baseShare;
    const result = validateLogSheet({ ...baseSheet, share: { ...legacy, masterData: "registered", picture: "public", skipper: "private", crew: "private" } });
    expect(result.share).toMatchObject({ remarks: "registered", picture: "registered", masterData: "registered" });
  });

});

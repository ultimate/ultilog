import { describe, expect, it } from "vitest";
import { sampleLogSheets } from "../fixtures/logbook";
import {
  applyTurnAction,
  filteredTurnPortions,
  describeTurns,
  reconcileTurns,
  sheetInterval,
  turnName,
  turnPortions,
  turnSuggestions,
} from "../../app/domain/logbook/turns";
import { emptyTurnState, type TurnAllocation } from "../../app/models/turn";
import type { LogSheet, SheetCrewMember } from "../../app/models/logbook";
import { calculateLogSheetMetrics } from "../../app/domain/logbook/sheet-metrics";
import { validateTurnState } from "../../app/lib/validation/turns";

const at = (day: number, hour = "08:00") =>
  `2026-07-${String(day).padStart(2, "0")}T${hour}:00Z`;
function sheet(day = 12, changes: Partial<LogSheet> = {}): LogSheet {
  return {
    ...structuredClone(sampleLogSheets[0]),
    id: `sheet-${day}`,
    title: `Respocean - Kroatien Tag ${day - 11}`,
    boatId: "boat",
    route: {
      from: "Split",
      to: "Split",
      departed: at(day),
      arrived: at(day, "18:00"),
    },
    crew: [],
    lines: [],
    ...changes,
  };
}
function crew(id: string, from = "", to = ""): SheetCrewMember {
  return {
    id,
    name: id,
    nationality: "",
    role: "",
    embarkationDateTime: from,
    disembarkationDateTime: to,
    embarkationPosition: "",
    disembarkationPosition: "",
  };
}
function changeover(time = "15:35") {
  const base = sheet(12, {
    crew: [
      crew("skipper", at(12), at(12, "18:00")),
      crew("old", at(12), at(12, time)),
      crew("new", at(12, time), at(12, "18:00")),
    ],
  });
  base.lines = [
    {
      ...sampleLogSheets[0].lines[0],
      id: "start",
      time: at(12),
      logNm: 0,
      sailMiles: 0,
      motorMiles: 0,
      engineHours: {},
    },
    {
      ...sampleLogSheets[0].lines[0],
      id: "handover",
      time: at(12, time),
      logNm: 30,
      sailMiles: 30,
      motorMiles: 0,
      engineHours: {},
    },
    {
      ...sampleLogSheets[0].lines[0],
      id: "end",
      time: at(12, "18:00"),
      logNm: 40,
      sailMiles: 10,
      motorMiles: 0,
      engineHours: {},
    },
  ];
  const initial = reconcileTurns([base]);
  const split = applyTurnAction([base], initial, {
    action: "split",
    turnId: initial.turns[0].id,
    at: at(12, time),
  });
  return { base, initial, split };
}

describe("owner-defined turns", () => {
  it("groups consecutive harbor sheets and derives the Respocean title", () => {
    const state = reconcileTurns([sheet(), sheet(13), sheet(14)]);
    expect(state.turns).toHaveLength(1);
    expect(state.turns[0].name).toBe("Respocean - Kroatien");
  });
  it("starts new turns for calendar gaps and boat changes", () => {
    expect(
      reconcileTurns([sheet(), sheet(14), sheet(15, { boatId: "other" })])
        .turns,
    ).toHaveLength(3);
  });
  it("ignores undated sheets but falls back to dated log entries", () => {
    const undated = sheet(12, {
      route: { from: "", to: "", departed: "", arrived: "" },
    });
    expect(sheetInterval(undated)).toBeUndefined();
    expect(reconcileTurns([undated]).turns).toEqual([]);
    undated.lines = [{ ...sampleLogSheets[0].lines[0], time: at(12) }];
    expect(sheetInterval(undated)?.start).toBe(Date.parse(at(12)));
  });
  it("retains identities and manual names when a prior day is inserted", () => {
    let state = reconcileTurns([sheet(13)]);
    const id = state.turns[0].id;
    state = applyTurnAction([sheet(13)], state, {
      action: "rename",
      turnId: id,
      name: "My voyage",
    });
    state = reconcileTurns([sheet(12), sheet(13)], state);
    expect(state.turns[0]).toMatchObject({
      id,
      name: "My voyage",
      nameMode: "manual",
    });
  });
  it("preserves explicit split and merge decisions across sheet and title changes", () => {
    const sheets = [sheet(), sheet(13), sheet(14)];
    let state = reconcileTurns(sheets);
    state = applyTurnAction(sheets, state, {
      action: "split",
      turnId: state.turns[0].id,
      at: at(13),
    });
    expect(reconcileTurns([...sheets, sheet(15)], state).turns).toHaveLength(2);
    state = applyTurnAction(sheets, state, {
      action: "merge",
      turnId: state.turns[0].id,
      nextId: state.turns[1].id,
      name: "Combined",
    });
    expect(reconcileTurns(sheets, state).turns).toHaveLength(1);
    expect(reconcileTurns(sheets, state).turns[0].name).toBe("Combined");
  });
  it("merges across a gap and boat change without splitting on the next save", () => {
    const sheets = [sheet(), sheet(15, { boatId: "other" })];
    let state = reconcileTurns(sheets);
    state = applyTurnAction(sheets, state, {
      action: "merge",
      turnId: state.turns[0].id,
      nextId: state.turns[1].id,
      name: "",
    });
    expect(reconcileTurns(sheets, state).turns).toHaveLength(1);
  });
  it.each(["09:17", "15:35", "17:59"])(
    "splits a shared sheet at %s with correct crew and exact mileage",
    (time) => {
      const { base, split } = changeover(time);
      const parts = turnPortions(base, split);
      expect(parts).toHaveLength(2);
      expect(parts[0].crewIds).toEqual(["skipper", "old"]);
      expect(parts[1].crewIds).toEqual(["skipper", "new"]);
      expect(parts[0].totalMiles).toBe(30);
      expect(parts[1].totalMiles).toBe(10);
      expect(parts.every((part) => part.partial && !part.estimated)).toBe(true);
      expect(
        describeTurns([base], split).filter((turn) =>
          turn.crewIds.includes("skipper"),
        ),
      ).toHaveLength(2);
    },
  );
  it("supports an overnight split and offset timestamps", () => {
    const s = sheet(12, {
      route: {
        from: "",
        to: "",
        departed: at(12, "22:00"),
        arrived: at(13, "05:00"),
      },
    });
    let state = reconcileTurns([s]);
    state = applyTurnAction([s], state, {
      action: "split",
      turnId: state.turns[0].id,
      at: "2026-07-13T02:15:00+02:00",
    });
    expect(state.turns[1].start).toBe("2026-07-13T00:15:00.000Z");
    expect(
      turnPortions(s, state).reduce(
        (sum, part) => sum + part.durationMinutes,
        0,
      ),
    ).toBe(420);
  });
  it("suggests actual changeover times, without splitting automatically; supports dismissal", () => {
    const { base, initial } = changeover("15:35");
    const suggestions = turnSuggestions([base], initial);
    expect(initial.turns).toHaveLength(1);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].at).toContain("15:35");
    const state = applyTurnAction([base], initial, {
      action: "dismiss",
      key: suggestions[0].key,
    });
    expect(turnSuggestions([base], state)).toEqual([]);
  });
  it("does not suggest a boundary when one crew member leaves without a replacement", () => {
    const s = sheet(12, {
      crew: [crew("skipper"), crew("old", at(12), at(12, "13:10"))],
    });
    expect(turnSuggestions([s], reconcileTurns([s]))).toEqual([]);
  });
  it("marks interpolated mileage and uncertain crew and preserves totals", () => {
    const { base, initial } = changeover();
    base.lines.splice(1, 1);
    base.crew[0].embarkationDateTime = "";
    const split = applyTurnAction([base], initial, {
      action: "split",
      turnId: initial.turns[0].id,
      at: at(12, "12:43"),
    });
    const parts = turnPortions(base, split);
    expect(parts.some((part) => part.estimated)).toBe(true);
    expect(parts.some((part) => part.estimatedCrew)).toBe(true);
    const metrics = calculateLogSheetMetrics(base.lines, base.route);
    for (const key of [
      "totalMiles",
      "sailMiles",
      "motorMiles",
      "motorHours",
      "motionDurationMinutes",
    ] as const)
      expect(parts.reduce((sum, part) => sum + part[key], 0)).toBeCloseTo(
        metrics[key],
      );
  });
  it("allows corrections but rejects totals that create or lose miles", () => {
    const { base, split } = changeover();
    const portions = turnPortions(base, split).map(
      ({
        turnId,
        totalMiles,
        sailMiles,
        motorMiles,
        durationMinutes,
        motionDurationMinutes,
        motorHours,
        crewIds,
      }) => ({
        turnId,
        totalMiles,
        sailMiles,
        motorMiles,
        durationMinutes,
        motionDurationMinutes,
        motorHours,
        crewIds,
      }),
    );
    portions[0].totalMiles = 25;
    portions[1].totalMiles = 15;
    const corrected = applyTurnAction([base], split, {
      action: "correct",
      sheetId: base.id,
      portions,
    });
    expect(turnPortions(base, corrected)[0].totalMiles).toBe(25);
    const edited = { ...base, remarks: "Unrelated" };
    expect(turnPortions(edited, corrected)[0].review).toBe(false);
    edited.lines = base.lines.map((line) => ({
      ...line,
      logNm: (line.logNm ?? 0) + 1,
    }));
    expect(turnPortions(edited, corrected)[0].review).toBe(true);
    portions[0].totalMiles = 90;
    expect(() =>
      applyTurnAction([base], split, {
        action: "correct",
        sheetId: base.id,
        portions,
      }),
    ).toThrow(/preserve/);
  });
  it("expires ongoing status without changing turn definitions", () => {
    const sheets = [sheet()];
    const state = reconcileTurns(sheets);
    const end = Date.parse(at(12, "18:00"));
    expect(describeTurns(sheets, state, end + 86400000)[0].ongoing).toBe(true);
    expect(describeTurns(sheets, state, end + 7 * 86400000)[0].ongoing).toBe(
      false,
    );
    expect(state.turns[0].end).toBeUndefined();
  });
  it("rejects empty splits, non-neighbor merges, malformed imported state", () => {
    const s = sheet();
    const state = reconcileTurns([s]);
    expect(() =>
      applyTurnAction([s], state, {
        action: "split",
        turnId: state.turns[0].id,
        at: at(12),
      }),
    ).toThrow();
    expect(() =>
      validateTurnState({ ...emptyTurnState(), turns: [{ id: "bad" }] }),
    ).toThrow();
    expect(() => validateTurnState(state)).not.toThrow();
  });
});

describe("turn names", () => {
  it.each([
    [
      ["Respocean - Kroatien Tag 1", "Respocean - Kroatien Tag 6"],
      "Respocean - Kroatien",
    ],
    [["Day 1 - Greek Islands", "Day 2 - Greek Islands"], "Greek Islands"],
    [["Ionian week", "Ionian week"], "Ionian week"],
    [["North coast", "South coast"], "coast"],
    [["Day 1", "Day 2"], ""],
    [["2026-07-12", "2026-07-13"], ""],
    [["Unrelated", "Different"], ""],
    [["Voyage", ""], ""],
  ])("derives %j as %s", (titles, expected) =>
    expect(turnName(titles)).toBe(expected),
  );
  it("keeps a deliberately empty name until automatic naming is restored", () => {
    const sheets = [sheet(), sheet(13)];
    let state = reconcileTurns(sheets);
    const turnId = state.turns[0].id;
    state = applyTurnAction(sheets, state, {
      action: "rename",
      turnId,
      name: "",
    });
    expect(reconcileTurns(sheets, state).turns[0].name).toBe("");
    state = applyTurnAction(sheets, state, {
      action: "rename",
      turnId,
      name: "",
      automatic: true,
    });
    expect(state.turns[0].name).toBe("Respocean - Kroatien");
  });
});

it("clips a multi-day sheet using timed mileage before aggregation", () => {
  const s = sheet(12, {
    route: { from: "", to: "", departed: at(12), arrived: at(13, "18:00") },
  });
  s.lines = [
    {
      ...sampleLogSheets[0].lines[0],
      id: "a",
      time: at(12),
      logNm: 0,
      sailMiles: 0,
      motorMiles: 0,
      engineHours: {},
    },
    {
      ...sampleLogSheets[0].lines[0],
      id: "b",
      time: at(13, "00:00"),
      logNm: 30,
      sailMiles: 30,
      motorMiles: 0,
      engineHours: {},
    },
    {
      ...sampleLogSheets[0].lines[0],
      id: "c",
      time: at(13, "18:00"),
      logNm: 40,
      sailMiles: 10,
      motorMiles: 0,
      engineHours: {},
    },
  ];
  const state = reconcileTurns([s]);
  const parts = filteredTurnPortions(s, state, "2026-07-13", "2026-07-13");
  expect(parts[0].totalMiles).toBeCloseTo(10);
  expect(parts[0].durationMinutes).toBe(18 * 60);
});

it("adjusts a boundary without changing turn identities or owner names", () => {
  const { base, split } = changeover();
  let named = applyTurnAction([base], split, {
    action: "rename",
    turnId: split.turns[1].id,
    name: "Second turn",
  });
  named = applyTurnAction([base], named, {
    action: "boundary",
    turnId: split.turns[1].id,
    at: at(12, "16:17"),
  });
  const reconciled = reconcileTurns([base], named);
  expect(reconciled.turns.map((turn) => turn.id)).toEqual(
    split.turns.map((turn) => turn.id),
  );
  expect(reconciled.turns[1]).toMatchObject({
    name: "Second turn",
    start: "2026-07-12T16:17:00.000Z",
  });
});

it("bounds automatically derived names for backup compatibility", () => {
  const title = "Voyage " + "Kroatien ".repeat(60);
  expect(turnName([title])).toHaveLength(195);
  expect(turnName(["a".repeat(201)])).toBe("");
});

it("validates corrections against the owner's motion threshold and flags preference changes", () => {
  const { base, split } = changeover();
  base.lines = base.lines.map((line, index) => ({
    ...line,
    logNm: 0,
    sailMiles: 0,
    motorMiles: 0,
    latitude: 45,
    longitude: 14 + index * 0.001,
  }));
  const threshold = 100;
  const portions = turnPortions(base, split, threshold).map(
    ({
      turnId,
      totalMiles,
      sailMiles,
      motorMiles,
      durationMinutes,
      motionDurationMinutes,
      motorHours,
      crewIds,
    }) => ({
      turnId,
      totalMiles,
      sailMiles,
      motorMiles,
      durationMinutes,
      motionDurationMinutes,
      motorHours,
      crewIds,
    }),
  );
  const state = applyTurnAction(
    [base],
    split,
    { action: "correct", sheetId: base.id, portions },
    threshold,
  );
  expect(
    turnPortions(base, state, threshold).every((part) => !part.review),
  ).toBe(true);
  expect(turnPortions(base, state, 0.001).every((part) => part.review)).toBe(
    true,
  );
});

it("uses the full recorded coverage when overlapping multi-day sheets exist", () => {
  const long = sheet(12, {
    route: { from: "", to: "", departed: at(12), arrived: at(17, "18:00") },
  });
  expect(reconcileTurns([long, sheet(13), sheet(18)]).turns).toHaveLength(1);
});

it("keeps a surviving named turn when its first sheet is deleted", () => {
  const sheets = [sheet(), sheet(13), sheet(14)];
  let state = reconcileTurns(sheets);
  const turnId = state.turns[0].id;
  state = applyTurnAction(sheets, state, {
    action: "rename",
    turnId,
    name: "Keep this name",
  });
  expect(reconcileTurns(sheets.slice(1), state).turns[0]).toMatchObject({
    id: turnId,
    name: "Keep this name",
    nameMode: "manual",
  });
});

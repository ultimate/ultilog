import type { LogSheet } from "../../models/logbook";
import {
  emptyTurnState,
  type Turn,
  type TurnState,
  type TurnSuggestion,
  type TurnPortion,
  type TurnAction,
  type TurnAllocation,
} from "../../models/turn";
import {
  calculateLogSheetMetrics,
  isLogLineMotionInterval,
} from "./sheet-metrics";

/** Parse stored sailing stamps without depending on the server/browser timezone. */
export function turnTime(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}/.test(value)) return NaN;
  const normalized = value.replace(/,\s*/, "T").trim();
  return Date.parse(
    /(?:Z|[+-]\d{2}:\d{2})$/.test(normalized)
      ? normalized
      : `${normalized.length === 10 ? normalized + "T00:00:00" : normalized}Z`,
  );
}
const stamp = (value: number) => new Date(value).toISOString();
export function sheetInterval(sheet: LogSheet) {
  const times = sheet.lines
    .map((line) => turnTime(line.time))
    .filter(Number.isFinite);
  const departure = turnTime(sheet.route.departed),
    arrival = turnTime(sheet.route.arrived);
  const start = Number.isFinite(departure)
    ? departure
    : times.length
      ? Math.min(...times)
      : arrival;
  const end =
    Number.isFinite(arrival) && arrival >= start
      ? arrival
      : times.length
        ? Math.max(start, ...times)
        : start;
  return Number.isFinite(start)
    ? { start, end: Math.max(start, end) }
    : undefined;
}
const overlaps = (start: number, end: number, a: number, b: number) =>
  end === start ? start >= a && start < b : start < b && end > a;
export function turnName(titles: string[]) {
  const clean = titles.map((title) => title.trim().replace(/\s+/g, " "));
  if (!clean.length || clean.some((title) => !title)) return "";
  const meaningful = (text: string) => {
    const words = text
      .toLowerCase()
      .split(/[^\p{L}]+/u)
      .filter(Boolean);
    return (
      words.some(
        (word) =>
          ![
            "tag",
            "day",
            "jour",
            "giorno",
            "logsheet",
            "log",
            "sheet",
          ].includes(word),
      ) &&
      (words.length > 1 || (words[0]?.length ?? 0) >= 4)
    );
  };
  const tidy = (text: string) => {
    const candidate = text
      .replace(/(?:[\s:–—-]*(?:day|tag|jour|giorno)\s*\d*)$/i, "")
      .replace(/^[\s:–—-]+|[\s:–—-]+$/g, "")
      .trim();
    if (candidate.length <= 200) return candidate;
    const boundary = candidate.slice(0, 201).lastIndexOf(" ");
    return boundary > 0 ? candidate.slice(0, boundary) : "";
  };
  if (clean.every((title) => title.toLowerCase() === clean[0].toLowerCase())) {
    const candidate = tidy(clean[0]);
    return meaningful(candidate) ? candidate : "";
  }
  const tokens = clean.map((title) => title.split(" "));
  let prefix = 0,
    suffix = 0;
  while (
    tokens.every(
      (words) =>
        words[prefix]?.toLowerCase() === tokens[0][prefix]?.toLowerCase(),
    ) &&
    prefix < Math.min(...tokens.map((words) => words.length))
  )
    prefix++;
  while (
    suffix < Math.min(...tokens.map((words) => words.length)) &&
    tokens.every(
      (words) =>
        words[words.length - 1 - suffix].toLowerCase() ===
        tokens[0][tokens[0].length - 1 - suffix].toLowerCase(),
    )
  )
    suffix++;
  return (
    [
      tidy(tokens[0].slice(0, prefix).join(" ")),
      tidy(suffix ? tokens[0].slice(-suffix).join(" ") : ""),
    ]
      .filter(meaningful)
      .sort((a, b) => b.length - a.length)[0] ?? ""
  );
}
export function reconcileTurns(
  sheets: LogSheet[],
  previous: TurnState = emptyTurnState(),
  createId = () => crypto.randomUUID(),
): TurnState {
  const records = sheets
    .flatMap((sheet) => {
      const range = sheetInterval(sheet);
      return range ? [{ sheet, ...range }] : [];
    })
    .sort((a, b) => a.start - b.start || a.sheet.id.localeCompare(b.sheet.id));
  if (!records.length) return { ...previous, turns: [] };
  const boundaries = new Map<number, string | undefined>([
    [records[0].start, undefined],
  ]);
  const endDate = (record: (typeof records)[number]) =>
    (
      [
        record.sheet.route.arrived,
        ...record.sheet.lines.map((line) => line.time),
        record.sheet.route.departed,
      ].find((value) => turnTime(value) === record.end) ?? stamp(record.end)
    ).slice(0, 10);
  let coveredUntil = records[0].end;
  let coveredDate = endDate(records[0]);
  for (let i = 1; i < records.length; i++) {
    const prior = records[i - 1],
      current = records[i];
    const priorDate = coveredDate;
    const currentDate = (
      current.sheet.route.departed || stamp(current.start)
    ).slice(0, 10);
    const gap =
      Date.parse(currentDate) - Date.parse(priorDate) >= 2 * 86400000 &&
      current.start > coveredUntil;
    if (
      (current.sheet.boatId !== prior.sheet.boatId || gap) &&
      !previous.merges.some(
        (range) =>
          current.start > turnTime(range.start) &&
          current.start < turnTime(range.end),
      )
    )
      boundaries.set(current.start, undefined);
    if (
      current.sheet.boatId !== prior.sheet.boatId ||
      current.end > coveredUntil
    ) {
      coveredUntil = current.end;
      coveredDate = endDate(current);
    }
  }
  for (const split of previous.splits)
    if (
      turnTime(split.at) > records[0].start &&
      turnTime(split.at) <= Math.max(...records.map((record) => record.end))
    )
      boundaries.set(turnTime(split.at), split.id);
  const used = new Set<string>();
  const starts = [...boundaries.keys()].sort((a, b) => a - b);
  const turns = starts.flatMap((start, index) => {
    const end = starts[index + 1] ?? Infinity;
    const members = records.filter((record) =>
      overlaps(record.start, record.end, start, end),
    );
    if (!members.length) return [];
    const pinnedId = boundaries.get(start);
    const old =
      previous.turns.find(
        (turn) =>
          !used.has(turn.id) &&
          (pinnedId ? turn.id === pinnedId : turnTime(turn.start) === start),
      ) ??
      previous.turns.find(
        (turn) =>
          !used.has(turn.id) &&
          !previous.splits.some((split) => split.id === turn.id) &&
          members.some((member) => member.sheet.id === turn.anchor),
      ) ??
      previous.turns.find(
        (turn) =>
          !used.has(turn.id) &&
          turnTime(turn.start) <= start &&
          (!turn.end || turnTime(turn.end) > start),
      );
    const id = pinnedId ?? old?.id ?? createId();
    used.add(id);
    return [
      {
        id,
        start: stamp(start),
        ...(Number.isFinite(end) ? { end: stamp(end) } : {}),
        anchor: members[0].sheet.id,
        nameMode: old?.nameMode ?? "automatic",
        name:
          old?.nameMode === "manual"
            ? old.name
            : turnName(members.map((member) => member.sheet.title)),
      } satisfies Turn,
    ];
  });
  return { ...previous, turns };
}
export function turnSuggestions(
  sheets: LogSheet[],
  state: TurnState,
): TurnSuggestion[] {
  const records = sheets
    .flatMap((sheet) => {
      const range = sheetInterval(sheet);
      return range ? [{ sheet, ...range }] : [];
    })
    .sort((a, b) => a.start - b.start);
  const suggestions: TurnSuggestion[] = [];
  const add = (
    at: number,
    sheetId: string,
    before: string[],
    after: string[],
  ) => {
    const leaving = before.filter((id) => !after.includes(id)).sort(),
      joining = after.filter((id) => !before.includes(id)).sort();
    if (
      !before.length ||
      !after.length ||
      !leaving.length ||
      !joining.length ||
      Math.max(leaving.length / before.length, joining.length / after.length) <
        0.5
    )
      return;
    const key = JSON.stringify([stamp(at), sheetId, leaving, joining]);
    if (
      !state.dismissed.includes(key) &&
      !state.turns.some((turn) => turnTime(turn.start) === at)
    )
      suggestions.push({ key, at: stamp(at), sheetId, leaving, joining });
  };
  records.forEach((record, index) => {
    const prior = records[index - 1];
    if (prior && prior.sheet.boatId === record.sheet.boatId)
      add(
        record.start,
        record.sheet.id,
        prior.sheet.crew.map((member) => member.id),
        record.sheet.crew.map((member) => member.id),
      );
    const events = [
      ...new Set(
        record.sheet.crew
          .flatMap((member) => [
            turnTime(member.embarkationDateTime),
            turnTime(member.disembarkationDateTime),
          ])
          .filter((at) => at > record.start && at < record.end),
      ),
    ].sort((a, b) => a - b);
    for (const at of events) {
      const aboard = (time: number) =>
        record.sheet.crew
          .filter((member) => {
            const start = turnTime(member.embarkationDateTime),
              end = turnTime(member.disembarkationDateTime);
            return (
              time >= (Number.isFinite(start) ? start : record.start) &&
              time < (Number.isFinite(end) ? end : record.end)
            );
          })
          .map((member) => member.id);
      // Allow handovers with a short pause between departures and arrivals.
      const next =
        events.find(
          (event) =>
            event >= at &&
            aboard(event).some((id) => !aboard(at - 1).includes(id)),
        ) ?? at;
      if (next - at <= 3 * 3600000)
        add(next, record.sheet.id, aboard(at - 1), aboard(next));
    }
  });
  return [
    ...new Map(
      suggestions.map((suggestion) => [suggestion.key, suggestion]),
    ).values(),
  ];
}
export function sheetFingerprint(
  sheet: LogSheet,
  turns: Turn[],
  threshold = 0.1,
) {
  return JSON.stringify([
    threshold,
    sheet.route.departed,
    sheet.route.arrived,
    sheet.boatId,
    sheet.crew.map((member) => [
      member.id,
      member.embarkationDateTime,
      member.disembarkationDateTime,
    ]),
    sheet.lines.map((line) => [
      line.time,
      line.logNm,
      line.sailMiles,
      line.motorMiles,
      line.engineHours,
      line.latitude,
      line.longitude,
    ]),
    turns.map((turn) => [turn.id, turn.start, turn.end]),
  ]);
}
export function turnPortions(
  sheet: LogSheet,
  state: TurnState,
  threshold = 0.1,
): TurnPortion[] {
  const range = sheetInterval(sheet);
  if (!range) return [];
  const matching = state.turns.filter((turn) =>
    overlaps(
      range.start,
      range.end,
      turnTime(turn.start),
      turn.end ? turnTime(turn.end) : Infinity,
    ),
  );
  const metrics = calculateLogSheetMetrics(sheet.lines, sheet.route, {
    stationaryDistanceThresholdNm: threshold,
  });
  const correction = state.corrections.find(
    (item) => item.sheetId === sheet.id,
  );
  const valid =
    correction?.fingerprint === sheetFingerprint(sheet, matching, threshold);
  const lines = sheet.lines
    .filter((line) => Number.isFinite(turnTime(line.time)))
    .slice()
    .sort((a, b) => turnTime(a.time) - turnTime(b.time));
  const keys = [
    "totalMiles",
    "sailMiles",
    "motorMiles",
    "durationMinutes",
    "motionDurationMinutes",
    "motorHours",
  ] as const;
  const weights = matching.map((turn) => {
    const start = Math.max(range.start, turnTime(turn.start)),
      end = Math.min(range.end, turn.end ? turnTime(turn.end) : range.end);
    const fraction =
      range.end > range.start
        ? Math.max(0, end - start) / (range.end - range.start)
        : 1;
    let estimated = false;
    const sums = {
      totalMiles: 0,
      sailMiles: 0,
      motorMiles: 0,
      durationMinutes: fraction,
      motionDurationMinutes: 0,
      motorHours: 0,
    };
    let lastLog = 0;
    lines.forEach((line, index) => {
      const at = turnTime(line.time),
        previous = lines[index - 1],
        from = previous ? turnTime(previous.time) : range.start;
      const share =
        at > from
          ? Math.max(0, Math.min(at, end) - Math.max(from, start)) / (at - from)
          : at >= start && (at < end || (end === range.end && at === end))
            ? 1
            : 0;
      const delta = line.logNm == null ? 0 : Math.max(0, line.logNm - lastLog);
      if (line.logNm != null) lastLog = line.logNm;
      const hours = Math.max(0, ...Object.values(line.engineHours ?? {}));
      sums.totalMiles +=
        share * Math.max(delta, (line.sailMiles ?? 0) + (line.motorMiles ?? 0));
      sums.sailMiles += share * (line.sailMiles ?? (hours ? 0 : delta));
      sums.motorMiles += share * (line.motorMiles ?? (hours ? delta : 0));
      sums.motorHours += share * hours;
      if (previous && isLogLineMotionInterval(previous, line, threshold))
        sums.motionDurationMinutes += (share * Math.max(0, at - from)) / 60000;
      if (share > 0 && share < 1) estimated = true;
    });
    return { start, end, fraction, sums, estimated };
  });
  return matching.map((turn, index) => {
    const weight = weights[index];
    const values = Object.fromEntries(
      keys.map((key) => {
        const total =
          key === "durationMinutes"
            ? (metrics.overallDurationMinutes ?? 0)
            : metrics[key];
        const sum = weights.reduce((sum, item) => sum + item.sums[key], 0);
        if (!sum && total && matching.length > 1) weight.estimated = true;
        return [key, total * (sum ? weight.sums[key] / sum : weight.fraction)];
      }),
    ) as Omit<TurnAllocation, "turnId" | "crewIds">;
    const crew = sheet.crew.filter((member) => {
      const start = turnTime(member.embarkationDateTime),
        end = turnTime(member.disembarkationDateTime);
      const a = Math.max(
          range.start,
          Number.isFinite(start) ? start : range.start,
        ),
        b = Math.min(range.end, Number.isFinite(end) ? end : range.end);
      return (
        overlaps(
          a,
          b,
          weight.start,
          weight.end === weight.start ? weight.end + 1 : weight.end,
        ) && b >= a
      );
    });
    const override = valid
      ? correction?.portions.find((portion) => portion.turnId === turn.id)
      : undefined;
    return {
      ...values,
      turnId: turn.id,
      crewIds: crew.map((member) => member.id),
      ...override,
      sheetId: sheet.id,
      start: stamp(weight.start),
      end: stamp(weight.end),
      partial: matching.length > 1,
      estimated: !override && weight.estimated,
      estimatedCrew:
        !override &&
        matching.length > 1 &&
        crew.some(
          (member) =>
            !Number.isFinite(turnTime(member.embarkationDateTime)) ||
            !Number.isFinite(turnTime(member.disembarkationDateTime)),
        ),
      review: Boolean(correction && !valid),
    };
  });
}
export function describeTurns(
  sheets: LogSheet[],
  state: TurnState,
  now = Date.now(),
  threshold = 0.1,
) {
  const portions = sheets.flatMap((sheet) =>
    turnPortions(sheet, state, threshold),
  );
  return state.turns.map((turn, index) => {
    const members = portions.filter((portion) => portion.turnId === turn.id);
    const through = Math.max(
      turnTime(turn.start),
      ...members.map((member) => turnTime(member.end)),
    );
    return {
      ...turn,
      portions: members,
      through: stamp(through),
      ongoing:
        index === state.turns.length - 1 &&
        through <= now &&
        now - through < 7 * 86400000,
      crewIds: [...new Set(members.flatMap((member) => member.crewIds))],
      totals: members.reduce(
        (sum, part) => ({
          totalMiles: sum.totalMiles + part.totalMiles,
          sailMiles: sum.sailMiles + part.sailMiles,
          motorMiles: sum.motorMiles + part.motorMiles,
          durationMinutes: sum.durationMinutes + part.durationMinutes,
          motionDurationMinutes:
            sum.motionDurationMinutes + part.motionDurationMinutes,
          motorHours: sum.motorHours + part.motorHours,
        }),
        {
          totalMiles: 0,
          sailMiles: 0,
          motorMiles: 0,
          durationMinutes: 0,
          motionDurationMinutes: 0,
          motorHours: 0,
        },
      ),
    };
  });
}
function invalid(message: string): never {
  throw new SyntaxError(message);
}
export function applyTurnAction(
  sheets: LogSheet[],
  state: TurnState,
  action: TurnAction,
  threshold = 0.1,
): TurnState {
  const next: TurnState = structuredClone(state);
  const turn =
    "turnId" in action
      ? next.turns.find((turn) => turn.id === action.turnId)
      : undefined;
  if ("turnId" in action && !turn)
    invalid("Turn no longer exists. Refresh and retry.");
  const checkName = (name: string) => {
    if (typeof name !== "string" || name.length > 200)
      invalid("Turn names must be at most 200 characters.");
    return name.trim();
  };
  if (action.action === "rename") {
    turn!.name = checkName(action.name);
    turn!.nameMode = action.automatic ? "automatic" : "manual";
  } else if (action.action === "split") {
    const at = turnTime(action.at),
      description = describeTurns(sheets, next, Date.now(), threshold).find(
        (item) => item.id === turn!.id,
      )!;
    if (
      !Number.isFinite(at) ||
      at <= turnTime(turn!.start) ||
      at >= turnTime(description.through)
    )
      invalid("Split must be inside the turn's recorded time range.");
    const before = sheets.some((sheet) => {
      const range = sheetInterval(sheet);
      return (
        range && overlaps(range.start, range.end, turnTime(turn!.start), at)
      );
    });
    const after = sheets.some((sheet) => {
      const range = sheetInterval(sheet);
      return (
        range &&
        overlaps(
          range.start,
          range.end,
          at,
          turn!.end ? turnTime(turn!.end) : Infinity,
        )
      );
    });
    if (!before || !after) invalid("Both turns must contain recorded sailing.");
    next.splits.push({ at: stamp(at), id: crypto.randomUUID() });
  } else if (action.action === "boundary") {
    const index = next.turns.findIndex((item) => item.id === turn!.id);
    const earlier = next.turns[index - 1];
    const description = describeTurns(sheets, next, Date.now(), threshold).find(
      (item) => item.id === turn!.id,
    )!;
    const at = turnTime(action.at);
    if (
      !earlier ||
      !Number.isFinite(at) ||
      at <= turnTime(earlier.start) ||
      at >= turnTime(description.through)
    )
      invalid("Choose a boundary inside the neighboring turns.");
    const before = sheets.some((sheet) => {
      const range = sheetInterval(sheet);
      return (
        range && overlaps(range.start, range.end, turnTime(earlier.start), at)
      );
    });
    const after = sheets.some((sheet) => {
      const range = sheetInterval(sheet);
      return (
        range &&
        overlaps(
          range.start,
          range.end,
          at,
          turn!.end ? turnTime(turn!.end) : Infinity,
        )
      );
    });
    if (!before || !after) invalid("Both turns must contain recorded sailing.");
    next.merges.push({
      start: earlier.start,
      end: stamp(turnTime(description.through) + 1),
    });
    next.splits = next.splits.filter((split) => split.at !== turn!.start);
    next.splits.push({ at: stamp(at), id: turn!.id });
  } else if (action.action === "merge") {
    const index = next.turns.findIndex((item) => item.id === turn!.id),
      following = next.turns[index + 1];
    if (!following || following.id !== action.nextId)
      invalid("Only neighboring turns can be merged.");
    const description = describeTurns(sheets, next, Date.now(), threshold).find(
      (item) => item.id === following.id,
    )!;
    next.merges.push({
      start: turn!.start,
      end: stamp(turnTime(description.through) + 1),
    });
    next.splits = next.splits.filter(
      (split) =>
        turnTime(split.at) <= turnTime(turn!.start) ||
        turnTime(split.at) > turnTime(description.through),
    );
    turn!.name = checkName(action.name);
    turn!.nameMode = action.automatic ? "automatic" : "manual";
  } else if (action.action === "dismiss") {
    if (!turnSuggestions(sheets, state).some((item) => item.key === action.key))
      invalid("Suggestion no longer exists.");
    next.dismissed.push(action.key);
  } else if (action.action === "correct") {
    const sheet = sheets.find((sheet) => sheet.id === action.sheetId);
    if (!sheet) invalid("Sheet no longer exists.");
    const expected = turnPortions(sheet, next, threshold);
    if (
      !Array.isArray(action.portions) ||
      action.portions.length !== expected.length ||
      new Set(action.portions.map((item) => item.turnId)).size !==
        expected.length
    )
      invalid("Correct every portion of the sheet.");
    const keys = [
      "totalMiles",
      "sailMiles",
      "motorMiles",
      "durationMinutes",
      "motionDurationMinutes",
      "motorHours",
    ] as const;
    for (const part of action.portions) {
      if (
        !expected.some((item) => item.turnId === part.turnId) ||
        !Array.isArray(part.crewIds) ||
        part.crewIds.some(
          (id) => !sheet.crew.some((member) => member.id === id),
        ) ||
        keys.some((key) => !Number.isFinite(part[key]) || part[key] < 0)
      )
        invalid("Invalid portion allocation.");
    }
    for (const key of keys)
      if (
        Math.abs(
          expected.reduce((sum, item) => sum + item[key], 0) -
            action.portions.reduce((sum, item) => sum + item[key], 0),
        ) > 0.0001
      )
        invalid("Corrected portions must preserve the sheet totals.");
    next.corrections = next.corrections.filter(
      (item) => item.sheetId !== sheet.id,
    );
    next.corrections.push({
      sheetId: sheet.id,
      threshold,
      fingerprint: sheetFingerprint(
        sheet,
        next.turns.filter((turn) =>
          expected.some((part) => part.turnId === turn.id),
        ),
        threshold,
      ),
      portions: action.portions,
    });
  } else invalid("Unknown turn operation.");
  return reconcileTurns(sheets, next);
}

/** Clip before aggregation, retaining timed evidence and proportional owner corrections. */
export function filteredTurnPortions(
  sheet: LogSheet,
  state: TurnState,
  fromDate = "",
  toDate = "",
  threshold = 0.1,
): TurnPortion[] {
  const parts = turnPortions(sheet, state, threshold);
  if (!fromDate && !toDate) return parts;
  const from = fromDate ? turnTime(fromDate) : -Infinity;
  const to = toDate ? turnTime(toDate) + 86400000 : Infinity;
  if (from >= to) return [];
  const result: TurnPortion[] = [];
  for (const part of parts) {
    const start = Math.max(turnTime(part.start), from),
      end = Math.min(turnTime(part.end), to);
    if (!overlaps(turnTime(part.start), turnTime(part.end), from, to)) continue;
    if (start === turnTime(part.start) && end === turnTime(part.end)) {
      result.push(part);
      continue;
    }
    const original = state.turns.find((turn) => turn.id === part.turnId)!;
    const points = [
      turnTime(original.start),
      start,
      end,
      original.end ? turnTime(original.end) : Infinity,
    ]
      .filter((point, index, array) => index === array.indexOf(point))
      .sort((a, b) => a - b);
    const replacements = points.slice(0, -1).map((point, index) => ({
      ...original,
      id: `${original.id}:clip:${index}`,
      start: stamp(point),
      ...(Number.isFinite(points[index + 1])
        ? { end: stamp(points[index + 1]) }
        : { end: undefined }),
    }));
    const calculation = turnPortions(
      sheet,
      {
        ...state,
        turns: state.turns.flatMap((turn) =>
          turn.id === original.id ? replacements : [turn],
        ),
        corrections: [],
      },
      threshold,
    );
    const candidates = calculation.filter((item) =>
      replacements.some((turn) => turn.id === item.turnId),
    );
    const clipped = candidates.find(
      (item) => turnTime(item.start) === start && turnTime(item.end) === end,
    );
    if (!clipped) continue;
    const keys = [
      "totalMiles",
      "sailMiles",
      "motorMiles",
      "durationMinutes",
      "motionDurationMinutes",
      "motorHours",
    ] as const;
    const values = Object.fromEntries(
      keys.map((key) => {
        const total = candidates.reduce((sum, item) => sum + item[key], 0);
        return [
          key,
          part[key] *
            (total
              ? clipped[key] / total
              : (end - start) / (turnTime(part.end) - turnTime(part.start))),
        ];
      }),
    ) as Pick<TurnPortion, (typeof keys)[number]>;
    const crewIds = sheet.crew
      .filter(
        (member) =>
          part.crewIds.includes(member.id) &&
          overlaps(
            Number.isFinite(turnTime(member.embarkationDateTime))
              ? turnTime(member.embarkationDateTime)
              : turnTime(part.start),
            Number.isFinite(turnTime(member.disembarkationDateTime))
              ? turnTime(member.disembarkationDateTime)
              : turnTime(part.end),
            start,
            end,
          ),
      )
      .map((member) => member.id);
    result.push({
      ...part,
      ...values,
      start: stamp(start),
      end: stamp(end),
      crewIds,
      partial: true,
      estimated: part.estimated || clipped.estimated,
    });
  }
  return result;
}

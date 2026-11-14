import type { TurnState } from "../../models/turn";
import { turnTime } from "../../domain/logbook/turns";
export function validateTurnState(value: unknown): asserts value is TurnState {
  const fail = (): never => {
    throw new SyntaxError("Malformed turn state.");
  };
  if (!value || typeof value !== "object") fail();
  const state = value as TurnState;
  if (
    !Number.isSafeInteger(state.revision) ||
    state.revision < 0 ||
    !Array.isArray(state.turns) ||
    !Array.isArray(state.splits) ||
    !Array.isArray(state.merges) ||
    !Array.isArray(state.dismissed) ||
    !Array.isArray(state.corrections)
  )
    fail();
  const time = (stamp: unknown) =>
    typeof stamp === "string" && Number.isFinite(turnTime(stamp));
  if (new Set(state.turns.map((turn) => turn.id)).size !== state.turns.length)
    fail();
  for (const turn of state.turns)
    if (
      !turn ||
      typeof turn.id !== "string" ||
      !turn.id ||
      typeof turn.anchor !== "string" ||
      typeof turn.name !== "string" ||
      turn.name.length > 200 ||
      !["automatic", "manual"].includes(turn.nameMode) ||
      !time(turn.start) ||
      (turn.end !== undefined &&
        (!time(turn.end) || turnTime(turn.end) <= turnTime(turn.start)))
    )
      fail();
  const ordered = state.turns
    .slice()
    .sort((a, b) => turnTime(a.start) - turnTime(b.start));
  for (let i = 1; i < ordered.length; i++)
    if (
      !ordered[i - 1].end ||
      turnTime(ordered[i - 1].end!) > turnTime(ordered[i].start)
    )
      fail();
  for (const split of state.splits)
    if (!split || !time(split.at) || typeof split.id !== "string") fail();
  for (const merge of state.merges)
    if (
      !merge ||
      !time(merge.start) ||
      !time(merge.end) ||
      turnTime(merge.end) <= turnTime(merge.start)
    )
      fail();
  if (state.dismissed.some((key) => typeof key !== "string")) fail();
  for (const correction of state.corrections) {
    if (
      correction?.threshold !== undefined &&
      (!Number.isFinite(correction.threshold) || correction.threshold < 0)
    )
      fail();
    if (
      !correction ||
      typeof correction.sheetId !== "string" ||
      typeof correction.fingerprint !== "string" ||
      !Array.isArray(correction.portions)
    )
      fail();
    for (const part of correction.portions)
      if (
        !part ||
        typeof part.turnId !== "string" ||
        !Array.isArray(part.crewIds) ||
        part.crewIds.some((id) => typeof id !== "string") ||
        [
          part.totalMiles,
          part.sailMiles,
          part.motorMiles,
          part.durationMinutes,
          part.motionDurationMinutes,
          part.motorHours,
        ].some((n) => !Number.isFinite(n) || n < 0)
      )
        fail();
  }
}

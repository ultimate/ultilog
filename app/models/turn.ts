export type Turn = {
  id: string;
  start: string;
  end?: string;
  name: string;
  nameMode: "automatic" | "manual";
  anchor: string;
};
export type TurnAllocation = {
  turnId: string;
  totalMiles: number;
  sailMiles: number;
  motorMiles: number;
  durationMinutes: number;
  motionDurationMinutes: number;
  motorHours: number;
  crewIds: string[];
};
export type TurnCorrection = {
  threshold?: number;
  sheetId: string;
  fingerprint: string;
  portions: TurnAllocation[];
};
export type TurnState = {
  sourceVersion?: string;
  revision: number;
  turns: Turn[];
  splits: { at: string; id: string }[];
  merges: { start: string; end: string }[];
  dismissed: string[];
  corrections: TurnCorrection[];
};
export type TurnSuggestion = {
  key: string;
  at: string;
  sheetId: string;
  leaving: string[];
  joining: string[];
};
export type TurnPortion = TurnAllocation & {
  sheetId: string;
  start: string;
  end: string;
  partial: boolean;
  estimated: boolean;
  review: boolean;
  estimatedCrew: boolean;
};
export type TurnAction =
  | { action: "rename"; turnId: string; name: string; automatic?: boolean }
  | { action: "split"; turnId: string; at: string }
  | { action: "boundary"; turnId: string; at: string }
  | {
      action: "merge";
      turnId: string;
      nextId: string;
      name: string;
      automatic?: boolean;
    }
  | { action: "dismiss"; key: string }
  | { action: "correct"; sheetId: string; portions: TurnAllocation[] };
export const emptyTurnState = (): TurnState => ({
  revision: 0,
  turns: [],
  splits: [],
  merges: [],
  dismissed: [],
  corrections: [],
});

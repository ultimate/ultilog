import type { QueryableDatabase } from "../db/logbook-database";
import { emptyTurnState, type TurnState } from "../../models/turn";

export class TurnsRepository {
  constructor(private db: QueryableDatabase) {}
  async lock(ownerId: string) {
    await this.db.query(
      `insert into logbook_turn_state (owner_id, revision, data) values (${this.db.placeholder(1)}, 1, ${this.db.placeholder(2)}) on conflict (owner_id) do nothing`,
      [ownerId, JSON.stringify({ ...emptyTurnState(), revision: 1 })],
    );
    // A row write serializes all of an owner's turn-affecting mutations on both backends.
    await this.db.query(
      `update logbook_turn_state set revision = revision where owner_id = ${this.db.placeholder(1)}`,
      [ownerId],
    );
  }
  async read(ownerId: string): Promise<TurnState> {
    const row = (
      await this.db.query<{ revision: number; data: string }>(
        `select revision, data from logbook_turn_state where owner_id = ${this.db.placeholder(1)}`,
        [ownerId],
      )
    ).rows[0];
    return row
      ? { ...JSON.parse(row.data), revision: Number(row.revision) }
      : emptyTurnState();
  }
  async save(ownerId: string, next: TurnState, previous: TurnState) {
    if (
      JSON.stringify({ ...next, revision: 0 }) ===
      JSON.stringify({ ...previous, revision: 0 })
    )
      return previous;
    const state = { ...next, revision: previous.revision + 1 };
    const result = await this.db.query<{ revision: number }>(
      `update logbook_turn_state set data = ${this.db.placeholder(1)}, revision = ${this.db.placeholder(2)} where owner_id = ${this.db.placeholder(3)} and revision = ${this.db.placeholder(4)} returning revision`,
      [JSON.stringify(state), state.revision, ownerId, previous.revision],
    );
    if (!result.rows.length)
      throw Object.assign(new Error("Turns changed. Refresh and retry."), {
        code: "revision_conflict",
      });
    return state;
  }
}

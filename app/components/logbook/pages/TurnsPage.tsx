import { useState, useEffect, useRef } from "react";
import type { PersistedLogbook } from "../../../models/logbook";
import {
  emptyTurnState,
  type TurnAction,
  type TurnAllocation,
} from "../../../models/turn";
import {
  applyTurnAction,
  describeTurns,
  sheetInterval,
  turnSuggestions,
  turnTime,
} from "../../../domain/logbook/turns";
import { useI18n } from "../../../lib/i18n";
import { useDateTimeFormat } from "../../../lib/DateTimeFormatProvider";
import { formatLogSheetDuration } from "../../../domain/logbook/sheet-metrics";
import { formatMiles } from "../../../lib/format-number";

export function TurnsPage({
  logbook,
  turnId,
  now,
  threshold,
  onOpen,
  onSheets,
  onSheet,
  onMutate,
}: {
  logbook: PersistedLogbook;
  turnId?: string;
  now: number;
  threshold: number;
  onOpen: (id?: string) => void;
  onSheets: (id: string) => void;
  onSheet: (id: string) => void;
  onMutate: (action: TurnAction) => Promise<void>;
}) {
  const { t } = useI18n();
  const { formatDateTime } = useDateTimeFormat();
  const state = logbook.turnState ?? emptyTurnState();
  const descriptions = describeTurns(logbook.sheets, state, now, threshold);
  const selected = descriptions.find((turn) => turn.id === turnId);
  const [operation, setOperation] = useState<TurnAction | null>(null);
  const editor = useRef<HTMLElement>(null);
  const isEditing = operation !== null;
  useEffect(() => {
    if (isEditing)
      editor.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [isEditing]);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const suggestions = turnSuggestions(logbook.sheets, state);
  const begin = (action: TurnAction) => {
    setOperation(action);
    setPreview(false);
    setError("");
  };
  const crewNames = (ids: string[]) =>
    ids
      .map(
        (id) =>
          logbook.crewMembers.find((member) => member.id === id)?.name ?? "",
      )
      .filter(Boolean)
      .join(", ");
  async function save() {
    if (!operation) return;
    setSaving(true);
    setError("");
    try {
      await onMutate(operation);
      setOperation(null);
      setPreview(false);
      if (
        operation.action === "merge" ||
        operation.action === "split" ||
        operation.action === "boundary"
      )
        onOpen(operation.turnId);
    } catch {
      setError(t("turns.error"));
    } finally {
      setSaving(false);
    }
  }
  let proposed: ReturnType<typeof describeTurns> | undefined;
  let previewError = "";
  if (preview && operation) {
    try {
      proposed = describeTurns(
        logbook.sheets,
        applyTurnAction(logbook.sheets, state, operation, threshold),
        now,
        threshold,
      );
    } catch {
      previewError = t("turns.error");
    }
  }
  return (
    <section className="module-panel turns-page">
      <div className="page-heading">
        <h1>{t("nav.turns")}</h1>
        {selected && (
          <button type="button" onClick={() => onOpen()}>
            {t("turns.all")}
          </button>
        )}
      </div>
      {logbook.sheets.some((sheet) => !sheetInterval(sheet)) && (
        <p>{t("turns.unassigned")}</p>
      )}
      {!descriptions.length && (
        <p className="empty-state">{t("turns.empty")}</p>
      )}
      <div className="turn-cards">
        {(selected ? [selected] : descriptions.slice().reverse()).map(
          (turn) => {
            const index = descriptions.findIndex(
                (candidate) => candidate.id === turn.id,
              ),
              next = descriptions[index + 1];
            return (
              <article className="info-card turn-card" key={turn.id}>
                <h2>
                  <button
                    type="button"
                    className="table-title-button"
                    onClick={() => onOpen(turn.id)}
                  >
                    {turn.name || t("turns.unnamed")}
                  </button>
                </h2>
                <p>
                  {formatDateTime(turn.start)} — {t("turns.through")}{" "}
                  {formatDateTime(turn.through)}{" "}
                  {turn.ongoing && (
                    <span className="status-pill">{t("turns.ongoing")}</span>
                  )}
                </p>
                <p>
                  {[
                    ...new Set(
                      turn.portions.map(
                        (part) =>
                          logbook.boats.find(
                            (boat) =>
                              boat.id ===
                              logbook.sheets.find(
                                (sheet) => sheet.id === part.sheetId,
                              )?.boatId,
                          )?.name,
                      ),
                    ),
                  ].join(", ")}
                </p>
                <p>
                  {t("crew.logSheets")}: {turn.portions.length} ·{" "}
                  {t("turns.crew")}: {turn.crewIds.length} ·{" "}
                  {formatMiles(turn.totals.totalMiles)} nm ·{" "}
                  {formatLogSheetDuration(turn.totals.durationMinutes)}
                </p>
                {turn.portions.some(
                  (part) => part.estimated || part.estimatedCrew,
                ) && <p className="status-pill">{t("turns.estimated")}</p>}
                <div className="turn-actions">
                  <button type="button" onClick={() => onSheets(turn.id)}>
                    {t("turns.viewSheets")}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      begin({
                        action: "rename",
                        turnId: turn.id,
                        name: turn.name,
                      })
                    }
                  >
                    {t("turns.rename")}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      begin({
                        action: "split",
                        turnId: turn.id,
                        at: new Date(
                          turnTime(turn.start) +
                            (turnTime(turn.through) - turnTime(turn.start)) / 2,
                        ).toISOString(),
                      })
                    }
                  >
                    {t("turns.split")}
                  </button>
                  {index > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        begin({
                          action: "boundary",
                          turnId: turn.id,
                          at: turn.start,
                        })
                      }
                    >
                      {t("turns.boundary")}
                    </button>
                  )}
                  {next && (
                    <button
                      type="button"
                      onClick={() =>
                        begin({
                          action: "merge",
                          turnId: turn.id,
                          nextId: next.id,
                          name:
                            turn.nameMode === "manual"
                              ? turn.name
                              : next.nameMode === "manual"
                                ? next.name
                                : "",
                          automatic:
                            turn.nameMode !== "manual" &&
                            next.nameMode !== "manual",
                        })
                      }
                    >
                      {t("turns.merge")}
                    </button>
                  )}
                </div>
                {selected && (
                  <>
                    <p>
                      {t("turns.crew")}: {crewNames(turn.crewIds)}
                    </p>
                    <dl className="turn-totals">
                      {(
                        [
                          "totalMiles",
                          "sailMiles",
                          "motorMiles",
                          "durationMinutes",
                          "motionDurationMinutes",
                          "motorHours",
                        ] as const
                      ).map((key) => (
                        <div key={key}>
                          <dt>{t(`turns.${key}`)}</dt>
                          <dd>{Number(turn.totals[key].toFixed(2))}</dd>
                        </div>
                      ))}
                    </dl>
                    <ul className="stack-list">
                      {turn.portions.map((part) => {
                        const sheet = logbook.sheets.find(
                          (sheet) => sheet.id === part.sheetId,
                        )!;
                        return (
                          <li key={part.sheetId}>
                            <button
                              type="button"
                              className="table-title-button"
                              onClick={() => onSheet(sheet.id)}
                            >
                              {sheet.title}
                            </button>
                            <small>
                              {formatDateTime(part.start)} —{" "}
                              {formatDateTime(part.end)} ·{" "}
                              {formatMiles(part.totalMiles)} nm{" "}
                              {part.partial && ` · ${t("turns.partial")}`}
                            </small>
                            {(part.estimated || part.estimatedCrew) && (
                              <small>{t("turns.estimated")}</small>
                            )}
                            {part.review && (
                              <strong>{t("turns.review")}</strong>
                            )}
                            {(part.partial || part.review) && (
                              <button
                                type="button"
                                onClick={() =>
                                  begin({
                                    action: "correct",
                                    sheetId: sheet.id,
                                    portions: descriptions
                                      .flatMap((turn) => turn.portions)
                                      .filter(
                                        (portion) =>
                                          portion.sheetId === sheet.id,
                                      )
                                      .map(
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
                                      ),
                                  })
                                }
                              >
                                {t("turns.correct")}
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
                {suggestions
                  .filter(
                    (suggestion) =>
                      turnTime(suggestion.at) > turnTime(turn.start) &&
                      (!turn.end ||
                        turnTime(suggestion.at) < turnTime(turn.end)),
                  )
                  .map((suggestion) => (
                    <div className="turn-suggestion" key={suggestion.key}>
                      <strong>{t("turns.suggestion")}</strong>
                      <p>{formatDateTime(suggestion.at)}</p>
                      <p>
                        {t("turns.leaving")}: {crewNames(suggestion.leaving)} ·{" "}
                        {t("turns.joining")}: {crewNames(suggestion.joining)}
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          begin({
                            action: "split",
                            turnId: turn.id,
                            at: suggestion.at,
                          })
                        }
                      >
                        {t("turns.preview")}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          begin({ action: "dismiss", key: suggestion.key })
                        }
                      >
                        {t("turns.dismiss")}
                      </button>
                    </div>
                  ))}
              </article>
            );
          },
        )}
      </div>
      {operation && (
        <section
          ref={editor}
          className="info-card turn-editor"
          aria-label={t("turns.preview")}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (preview && !previewError) void save();
              else setPreview(true);
            }}
          >
            {(operation.action === "rename" ||
              operation.action === "merge") && (
              <>
                <label>
                  {t("turns.name")}
                  <input
                    maxLength={200}
                    value={operation.name}
                    onChange={(event) => {
                      setOperation({
                        ...operation,
                        name: event.target.value,
                        automatic: false,
                      });
                      setPreview(false);
                    }}
                  />
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={Boolean(operation.automatic)}
                    onChange={(event) => {
                      setOperation({
                        ...operation,
                        automatic: event.target.checked,
                      });
                      setPreview(false);
                    }}
                  />
                  {t("turns.suggested")}
                </label>
              </>
            )}
            {(operation.action === "split" ||
              operation.action === "boundary") && (
              <label>
                {t("turns.timezone")}
                <input
                  required
                  type="datetime-local"
                  value={operation.at.slice(0, 16)}
                  onChange={(event) => {
                    if (event.target.value)
                      setOperation({
                        ...operation,
                        at: event.target.value + ":00Z",
                      });
                    setPreview(false);
                  }}
                />
              </label>
            )}
            {operation.action === "correct" && (
              <>
                <p>{t("turns.allocationHelp")}</p>
                {operation.portions.map((part, index) => (
                  <fieldset key={part.turnId}>
                    <legend>
                      {state.turns.find((turn) => turn.id === part.turnId)
                        ?.name || t("turns.unnamed")}
                    </legend>
                    {(
                      [
                        "totalMiles",
                        "sailMiles",
                        "motorMiles",
                        "durationMinutes",
                        "motionDurationMinutes",
                        "motorHours",
                      ] as const
                    ).map((key) => (
                      <label key={key}>
                        {t(`turns.${key}`)}
                        <input
                          type="number"
                          min="0"
                          step="any"
                          required
                          value={part[key]}
                          onChange={(event) => {
                            const portions = structuredClone(
                              operation.portions,
                            );
                            portions[index][key] = Number(event.target.value);
                            setOperation({ ...operation, portions });
                            setPreview(false);
                          }}
                        />
                      </label>
                    ))}
                    <div>
                      {t("turns.crew")}
                      {logbook.sheets
                        .find((sheet) => sheet.id === operation.sheetId)
                        ?.crew.map((member) => (
                          <label key={member.id}>
                            <input
                              type="checkbox"
                              checked={part.crewIds.includes(member.id)}
                              onChange={(event) => {
                                const portions = structuredClone(
                                  operation.portions,
                                );
                                portions[index].crewIds = event.target.checked
                                  ? [...part.crewIds, member.id]
                                  : part.crewIds.filter(
                                      (id) => id !== member.id,
                                    );
                                setOperation({ ...operation, portions });
                                setPreview(false);
                              }}
                            />
                            {member.name}
                          </label>
                        ))}
                    </div>
                  </fieldset>
                ))}
              </>
            )}
            {preview && (
              <div aria-live="polite">
                {previewError ? (
                  <p role="alert">{previewError}</p>
                ) : (
                  proposed
                    ?.filter((turn) =>
                      operation.action === "correct"
                        ? turn.portions.some(
                            (part) => part.sheetId === operation.sheetId,
                          )
                        : operation.action === "split" ||
                            operation.action === "merge" ||
                            operation.action === "boundary" ||
                            operation.action === "rename"
                          ? turn.id === operation.turnId ||
                            (operation.action === "boundary" &&
                              turn.id ===
                                state.turns[
                                  state.turns.findIndex(
                                    (item) => item.id === operation.turnId,
                                  ) - 1
                                ]?.id) ||
                            (operation.action === "split" &&
                              turn.start === operation.at)
                          : true,
                    )
                    .map((turn) => (
                      <p key={turn.id}>
                        {turn.name || t("turns.unnamed")} ·{" "}
                        {formatDateTime(turn.start)} —{" "}
                        {formatDateTime(turn.through)} · {turn.portions.length}{" "}
                        {t("crew.logSheets")} · {crewNames(turn.crewIds)} ·{" "}
                        {formatMiles(turn.totals.totalMiles)} nm ·{" "}
                        {formatLogSheetDuration(turn.totals.durationMinutes)}
                      </p>
                    ))
                )}
              </div>
            )}
            {error && <p role="alert">{error}</p>}
            <div className="turn-actions">
              <button type="submit" disabled={saving || Boolean(previewError)}>
                {preview ? t("turns.apply") : t("turns.preview")}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => setOperation(null)}
              >
                {t("turns.cancel")}
              </button>
            </div>
          </form>
        </section>
      )}
    </section>
  );
}

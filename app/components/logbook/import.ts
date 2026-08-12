import type { PersistedLogbook } from "../../models/logbook";

/** Deliberate, destructive import. Never use this helper for routine persistence. */
export function replaceEntireLogbook(logbook: PersistedLogbook) {
  return fetch("/api/logbook/import", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Ultilog-Confirm-Replace": "replace-my-entire-logbook",
    },
    body: JSON.stringify(logbook),
  });
}

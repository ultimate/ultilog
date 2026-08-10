/** Creates an opaque identifier once, at the boundary where a log line is created. */
export function createLogLineId() {
  return globalThis.crypto.randomUUID();
}

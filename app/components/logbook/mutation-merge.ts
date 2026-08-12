const concurrencyKeys = new Set(["revision", "createdAt", "updatedAt"]);

/** Merge an authoritative mutation result without rolling back edits made in flight. */
export function mergeMutationResult<T extends Record<string, unknown>>(current: T, submitted: T, persisted: T): T {
  const merged = { ...current };
  for (const [key, value] of Object.entries(persisted)) {
    if (concurrencyKeys.has(key) || sameValue(current[key], submitted[key])) {
      (merged as Record<string, unknown>)[key] = value;
    }
  }
  return merged;
}

function sameValue(left: unknown, right: unknown) {
  if (Object.is(left, right)) return true;
  if (left == null || right == null) return false;
  if (typeof left !== "object" || typeof right !== "object") return false;
  return JSON.stringify(left) === JSON.stringify(right);
}

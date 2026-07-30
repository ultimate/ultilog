export function isDemoSandboxSessionExpired(expiresAt: unknown, now = Date.now()) {
  if (typeof expiresAt !== "string" || !expiresAt) return false;
  const expiry = Date.parse(expiresAt);
  return !Number.isFinite(expiry) || expiry <= now;
}

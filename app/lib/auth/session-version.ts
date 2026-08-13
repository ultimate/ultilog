import { getUserSessionVersion } from "../users";

export async function isUserSessionVersionCurrent(userId: string, sessionVersion: unknown) {
  if (typeof sessionVersion !== "number") return false;
  const currentVersion = await getUserSessionVersion(userId);
  return currentVersion !== undefined && currentVersion === sessionVersion;
}

import { userHasGroup } from "./users";

/**
 * Stable capabilities used at server-side authorization boundaries.
 *
 * Keep product and billing plan names out of feature checks. Future sources of
 * access (such as subscriptions or trials) can be resolved here without
 * changing every protected route.
 */
export const entitlementGroups = {
  "admin:manage-users": ["admin"],
} as const;

export type Entitlement = keyof typeof entitlementGroups;

export async function userHasEntitlement(userId: string, entitlement: Entitlement) {
  const groups = entitlementGroups[entitlement];
  const memberships = await Promise.all(groups.map((group) => userHasGroup(userId, group)));
  return memberships.some(Boolean);
}

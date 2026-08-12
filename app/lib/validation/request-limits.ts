export const ENTITY_REQUEST_LIMITS = {
  // Representative fixture payloads are ~1.5 KiB per boat and ~5 KiB per
  // 5-line sheet. The larger ceilings leave room for the currently embedded,
  // base64-encoded image (up to ~1.34 MiB on the wire).
  boat: 2 * 1024 * 1024,
  crewMember: 2 * 1024 * 1024,
  sheet: 3 * 1024 * 1024,
} as const;

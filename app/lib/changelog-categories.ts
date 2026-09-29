/** The complete set of categories understood by changelog producers and consumers. */
export const CHANGELOG_CATEGORIES = ["feature", "improvement", "fix", "security", "documentation"] as const;

export type ChangelogCategory = (typeof CHANGELOG_CATEGORIES)[number];

const changelogCategories = new Set<string>(CHANGELOG_CATEGORIES);

export const isChangelogCategory = (value: unknown): value is ChangelogCategory =>
  typeof value === "string" && changelogCategories.has(value);

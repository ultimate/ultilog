import source from "./changelog.json";

export const CHANGELOG_CATEGORIES = [
  "feature",
  "improvement",
  "fix",
  "security",
] as const;
export const CHANGELOG_LOCALES = ["en", "de", "fr", "it"] as const;

export type ChangelogCategory = (typeof CHANGELOG_CATEGORIES)[number];
export type ChangelogLocale = (typeof CHANGELOG_LOCALES)[number];
export type ChangelogTitle = { readonly en: string } & Partial<
  Readonly<Record<Exclude<ChangelogLocale, "en">, string>>
>;

export type ChangelogEntry = {
  /** Stable identifier: once published, this value must never be changed or reused. */
  readonly id: string;
  readonly category: ChangelogCategory;
  readonly title: ChangelogTitle;
};

const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const categories = new Set<string>(CHANGELOG_CATEGORIES);
const locales = new Set<string>(CHANGELOG_LOCALES);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function requireOnlyFields(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  context: string,
): void {
  const unexpected = Object.keys(value).find((field) => !allowed.has(field));
  if (unexpected !== undefined)
    throw new TypeError(`Unexpected ${context} field: ${unexpected}`);
}

function parseTitle(value: unknown): ChangelogTitle {
  if (!isRecord(value))
    throw new TypeError("A changelog title must be an object");
  requireOnlyFields(value, locales, "title");

  for (const locale of CHANGELOG_LOCALES) {
    const translation = value[locale];
    if (locale === "en" && translation === undefined)
      throw new TypeError("A changelog title requires an English translation");
    if (
      translation !== undefined &&
      (typeof translation !== "string" || translation.trim() === "")
    ) {
      throw new TypeError(`Invalid ${locale} changelog title`);
    }
  }

  return Object.fromEntries(
    CHANGELOG_LOCALES.filter((locale) => value[locale] !== undefined).map(
      (locale) => [locale, value[locale]],
    ),
  ) as ChangelogTitle;
}

/** Validate source-controlled changelog content and return its canonical shape. */
export function parseChangelog(value: unknown): ChangelogEntry[] {
  if (!Array.isArray(value))
    throw new TypeError("Changelog data must be an array");

  const ids = new Set<string>();
  let previousId: string | undefined;
  return value.map((candidate) => {
    if (!isRecord(candidate))
      throw new TypeError("A changelog entry must be an object");
    requireOnlyFields(
      candidate,
      new Set(["id", "category", "title"]),
      "changelog entry",
    );

    const { id, category } = candidate;
    if (typeof id !== "string" || !idPattern.test(id))
      throw new TypeError("Invalid changelog ID: expected kebab-case");
    if (ids.has(id)) throw new TypeError(`Duplicate changelog ID: ${id}`);
    if (previousId !== undefined && previousId >= id)
      throw new TypeError("Changelog entries must be ordered by ID");
    if (typeof category !== "string" || !categories.has(category))
      throw new TypeError(
        `Unsupported changelog category: ${String(category)}`,
      );

    ids.add(id);
    previousId = id;
    return {
      id,
      category: category as ChangelogCategory,
      title: parseTitle(candidate.title),
    };
  });
}

export const changelog = parseChangelog(source);

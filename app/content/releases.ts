import { isChangelogCategory, type ChangelogCategory } from "../lib/changelog-categories";
import { parseReleaseVersion, type ReleaseVersion } from "../lib/build-info-types";

export type ChangelogTitle = {
  en: string;
  de: string | null;
  fr: string | null;
  it: string | null;
};

export type ChangelogEntry = {
  category: ChangelogCategory;
  prNumber: number;
  prUrl: string;
  title: ChangelogTitle;
};

export type Release = {
  version: ReleaseVersion;
  releasedAt: string;
  entries: ChangelogEntry[];
};

export type ReleaseData = Release[];

const locales = ["en", "de", "fr", "it"] as const;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseTitle = (value: unknown): ChangelogTitle => {
  if (!isRecord(value) || typeof value.en !== "string" || value.en.trim() === "") {
    throw new TypeError("A changelog title requires a non-empty English translation");
  }
  for (const key of Object.keys(value)) {
    if (!(locales as readonly string[]).includes(key)) throw new TypeError(`Unsupported title locale: ${key}`);
  }
  for (const locale of locales) {
    if (locale !== "en" && value[locale] == null) continue;
    if (typeof value[locale] !== "string" || value[locale].trim() === "") {
      throw new TypeError(`Invalid ${locale} changelog title`);
    }
  }
  return { en: value.en, de: (value.de as string | null) ?? null, fr: (value.fr as string | null) ?? null, it: (value.it as string | null) ?? null };
};

const parseTimestamp = (value: unknown): string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) {
    throw new TypeError("Invalid release timestamp: expected UTC ISO 8601");
  }
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.valueOf())) throw new TypeError("Invalid release timestamp");
  const normalizedInput = value.replace(/Z$/, value.includes(".") ? "Z" : ".000Z");
  if (timestamp.toISOString() !== normalizedInput) throw new TypeError("Invalid release timestamp");
  return value;
};

const parseEntry = (value: unknown): ChangelogEntry => {
  if (!isRecord(value) || !isChangelogCategory(value.category)) throw new TypeError("Unsupported changelog category");
  if (!Number.isSafeInteger(value.prNumber) || (value.prNumber as number) <= 0) throw new TypeError("Invalid PR number");
  if (typeof value.prUrl !== "string") throw new TypeError("Invalid PR URL");
  let url: URL;
  try {
    url = new URL(value.prUrl);
  } catch {
    throw new TypeError("Invalid PR URL");
  }
  if (url.protocol !== "https:" || !url.pathname.endsWith(`/pull/${value.prNumber}`)) {
    throw new TypeError("PR URL must be HTTPS and match the PR number");
  }
  return { category: value.category, prNumber: value.prNumber as number, prUrl: url.toString(), title: parseTitle(value.title) };
};

/** Parse release JSON generated at build time. */
export function parseReleaseData(value: unknown): ReleaseData {
  if (!Array.isArray(value)) throw new TypeError("Release data must be an array");
  return value.map((release) => {
    if (!isRecord(release) || !Array.isArray(release.entries)) throw new TypeError("Invalid release data");
    return {
      version: parseReleaseVersion(release.version),
      releasedAt: parseTimestamp(release.releasedAt),
      entries: release.entries.map(parseEntry),
    };
  });
}

import { describe, expect, it } from "vitest";
import {
  CHANGELOG_CATEGORIES,
  changelog,
  parseChangelog,
  parseGeneratedChangelog,
} from "../../../app/content/changelog";

const entry = {
  id: "stable-entry",
  category: "feature",
  title: { en: "English" },
};

describe("changelog authoring contract", () => {
  it("loads the source-controlled changelog", () => {
    expect(changelog).toEqual(parseChangelog(changelog));
  });

  it.each(CHANGELOG_CATEGORIES)(
    "accepts the %s category and supported translations",
    (category) => {
      expect(
        parseChangelog([
          {
            ...entry,
            category,
            title: {
              en: "English",
              de: "Deutsch",
              fr: "Français",
              it: "Italiano",
            },
          },
        ]),
      ).toEqual([
        {
          ...entry,
          category,
          title: {
            en: "English",
            de: "Deutsch",
            fr: "Français",
            it: "Italiano",
          },
        },
      ]);
    },
  );

  it.each([
    [[entry, entry], /duplicate/i],
    [[{ ...entry, id: "Not-Kebab" }], /kebab/i],
    [[{ ...entry, category: "documentation" }], /category/i],
    [[{ ...entry, title: { en: "English", nl: "Nederlands" } }], /field/i],
    [[{ ...entry, title: { en: " " } }], /title/i],
    [[{ ...entry, extra: true }], /field/i],
    [[{ ...entry, title: { en: "English", extra: true } }], /field/i],
    [
      [
        { ...entry, id: "z-entry" },
        { ...entry, id: "a-entry" },
      ],
      /ordered/i,
    ],
  ] as const)("rejects invalid changelog content", (value, error) => {
    expect(() => parseChangelog(value)).toThrow(error);
  });
});

describe("generated changelog contract", () => {
  const commitSha = "0123456789abcdef0123456789abcdef01234567";
  const generated = {
    ...entry,
    introduction: {
      commitSha,
      shortSha: commitSha.slice(0, 7),
      introducedAt: "2026-10-03T12:30:00.000Z",
    },
  };

  it("accepts normalized metadata derived from a stable source ID", () => {
    expect(parseGeneratedChangelog([generated])).toEqual([generated]);
  });

  it.each([
    [{ ...generated, introduction: undefined }, /missing introduction/i],
    [
      {
        ...generated,
        introduction: { ...generated.introduction, commitSha: "0123456" },
      },
      /commit SHA/i,
    ],
    [
      {
        ...generated,
        introduction: { ...generated.introduction, shortSha: "abcdef0" },
      },
      /short SHA/i,
    ],
    [
      {
        ...generated,
        introduction: {
          ...generated.introduction,
          introducedAt: "2026-10-03T14:30:00+02:00",
        },
      },
      /normalized UTC/i,
    ],
    [
      {
        ...generated,
        introduction: { ...generated.introduction, pullRequest: 42 },
      },
      /unexpected/i,
    ],
    [{ ...generated, version: "1.2.3" }, /unexpected/i],
  ] as const)(
    "rejects invalid or legacy generated metadata",
    (candidate, error) => {
      expect(() => parseGeneratedChangelog([candidate])).toThrow(error);
    },
  );
});

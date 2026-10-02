import { describe, expect, it } from "vitest";
import {
  CHANGELOG_CATEGORIES,
  changelog,
  parseChangelog,
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

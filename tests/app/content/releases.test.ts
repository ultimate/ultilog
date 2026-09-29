import { describe, expect, it } from "vitest";
import { CHANGELOG_CATEGORIES } from "../../../app/lib/changelog-categories";
import { parseReleaseData } from "../../../app/content/releases";

const validRelease = {
  version: "260911.0",
  releasedAt: "2026-09-29T12:30:00Z",
  entries: [{ category: "feature", prNumber: 42, prUrl: "https://github.com/example/ultilog/pull/42", title: { en: "Add releases", de: "Releases hinzufügen" } }],
};

describe("release data", () => {
  it("accepts every shared category and supported title locale", () => {
    const entries = CHANGELOG_CATEGORIES.map((category, index) => ({ ...validRelease.entries[0], category, prNumber: index + 1, prUrl: `https://github.com/example/ultilog/pull/${index + 1}`, title: { en: "English", de: "Deutsch", fr: "Français", it: "Italiano" } }));
    expect(parseReleaseData([{ ...validRelease, entries }])[0].entries).toHaveLength(CHANGELOG_CATEGORIES.length);
  });

  it.each([
    { ...validRelease, releasedAt: "2026-09-29" },
    { ...validRelease, releasedAt: "2026-02-30T12:30:00Z" },
    { ...validRelease, entries: [{ ...validRelease.entries[0], category: "unknown" }] },
    { ...validRelease, entries: [{ ...validRelease.entries[0], title: { de: "Fehlt" } }] },
    { ...validRelease, entries: [{ ...validRelease.entries[0], prNumber: 0 }] },
    { ...validRelease, entries: [{ ...validRelease.entries[0], prUrl: "https://github.com/example/ultilog/pull/99" }] },
  ])("rejects malformed release data", (release) => {
    expect(() => parseReleaseData([release])).toThrow();
  });
});

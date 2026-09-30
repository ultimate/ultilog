import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { I18nProvider, t, type Locale } from "../../app/lib/i18n";
import { ChangelogPage, localizedEntryTitle } from "../../app/templates/ChangelogPage";
import type { ReleaseData } from "../../app/content/releases";

const entries = [
  { category: "feature" as const, prNumber: 10, prUrl: "https://github.com/example/ultilog/pull/10", title: { en: "English feature", de: "Deutsche Funktion" } },
  { category: "improvement" as const, prNumber: 11, prUrl: "https://github.com/example/ultilog/pull/11", title: { en: "Better sailing" } },
  { category: "fix" as const, prNumber: 12, prUrl: "https://github.com/example/ultilog/pull/12", title: { en: "Fixed compass" } },
  { category: "security" as const, prNumber: 13, prUrl: "https://github.com/example/ultilog/pull/13", title: { en: "Safer sessions" } },
];
const releases: ReleaseData = [
  { version: "260930.0" as ReleaseData[0]["version"], releasedAt: "2026-09-30T23:30:00.000Z", entries },
  { version: "260929.0" as ReleaseData[0]["version"], releasedAt: "2026-09-29T12:00:00.000Z", entries: [] },
];
const render = (locale: Locale, data = releases) => renderToStaticMarkup(<I18nProvider><ChangelogPage releases={data} localeOverride={locale} /></I18nProvider>);

describe("ChangelogPage", () => {
  it("renders English releases, every populated category, and source PR links", () => {
    const markup = render("en");
    for (const heading of ["Features", "Improvements", "Fixes", "Security"]) expect(markup).toContain(`>${heading}<`);
    expect(markup).toContain("English feature");
    expect(markup).toContain('href="https://github.com/example/ultilog/pull/10"');
    expect(markup).toContain("September 30, 2026");
    expect(markup).toContain("This release has no user-facing changes.");
  });

  it.each(["de", "fr", "it"] as const)("localizes the %s interface, date, and English-only notice", (locale) => {
    const markup = render(locale);
    expect(markup).toContain(t(locale, "changelog.title"));
    expect(markup).toContain(t(locale, "changelog.category.feature"));
    expect(markup).toContain(t(locale, "changelog.englishNotice"));
    expect(markup).toContain(locale === "de" ? "30. September 2026" : locale === "fr" ? "30 septembre 2026" : "30 settembre 2026");
  });

  it("falls back per entry while using a future translation when present", () => {
    const markup = render("de");
    expect(markup).toContain("Deutsche Funktion");
    expect(markup).toContain("Better sailing");
    expect(localizedEntryTitle(entries[0], "de")).toBe("Deutsche Funktion");
    expect(localizedEntryTitle(entries[1], "de")).toBe("Better sailing");
  });

  it("omits empty category headings and handles an empty artifact", () => {
    const oneCategory = [{ ...releases[0], entries: [entries[0]] }];
    expect(render("en", oneCategory)).not.toContain(">Fixes<");
    expect(render("en", [])).toContain("No production releases are available yet.");
  });
});

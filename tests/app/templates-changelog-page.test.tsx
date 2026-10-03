import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  ChangelogPage,
  groupByIntroduction,
} from "../../app/templates/ChangelogPage";
import { ModuleTabs } from "../../app/templates/ModuleTabs";
import { readFileSync } from "node:fs";
import { I18nProvider, type Locale } from "../../app/lib/i18n";
import type {
  GeneratedChangelogEntry,
  ChangelogCategory,
} from "../../app/content/changelog";

const sha = (character: string) => character.repeat(40);
const entry = (
  id: string,
  category: ChangelogCategory,
  commitSha: string,
  introducedAt: string,
  title: GeneratedChangelogEntry["title"],
): GeneratedChangelogEntry => ({
  id,
  category,
  title,
  introduction: { commitSha, shortSha: commitSha.slice(0, 7), introducedAt },
});

const olderSha = sha("a");
const newerSha = sha("b");
const entries: GeneratedChangelogEntry[] = [
  entry("security-entry", "security", newerSha, "2026-10-03T23:30:00.000Z", {
    en: "Escape <script> & quotes",
  }),
  entry("fix-entry", "fix", newerSha, "2026-10-03T23:30:00.000Z", {
    en: "Fix",
    de: "Fehlerbehebung",
    fr: "Correction",
    it: "Correzione",
  }),
  entry(
    "improvement-entry",
    "improvement",
    newerSha,
    "2026-10-03T23:30:00.000Z",
    {
      en: "Improve",
      de: "Verbesserung",
      fr: "Amélioration",
      it: "Miglioramento",
    },
  ),
  entry("feature-entry", "feature", newerSha, "2026-10-03T23:30:00.000Z", {
    en: "Feature",
    de: "Funktion",
    fr: "Fonctionnalité",
    it: "Funzionalità",
  }),
  entry("older-entry", "fix", olderSha, "2026-09-01T10:00:00.000Z", {
    en: "Older",
  }),
];

const renderPage = (locale: Locale, data = entries) =>
  renderToStaticMarkup(
    <I18nProvider>
      <ChangelogPage entries={data} locale={locale} />
    </I18nProvider>,
  );

describe("ChangelogPage", () => {
  it.each([
    ["en", "What&#x27;s new", "October 3, 2026"],
    ["de", "Neuigkeiten", "3. Oktober 2026"],
    ["fr", "Nouveautés", "3 octobre 2026"],
    ["it", "Novità", "3 ottobre 2026"],
  ] as const)(
    "localizes headings and UTC dates in %s",
    (locale, heading, date) => {
      const markup = renderPage(locale);
      expect(markup).toContain(`<h1>${heading}</h1>`);
      expect(markup).toContain(date);
    },
  );

  it("groups by exact introduction commit with newest commits first", () => {
    const groups = groupByIntroduction(entries);
    expect(groups.map(({ commitSha }) => commitSha)).toEqual([
      newerSha,
      olderSha,
    ]);
    const markup = renderPage("en");
    expect(markup.indexOf(newerSha.slice(0, 7))).toBeLessThan(
      markup.indexOf(olderSha.slice(0, 7)),
    );
  });

  it("renders categories in the fixed order and tolerates missing categories", () => {
    const markup = renderPage("en");
    expect(markup.indexOf("Features")).toBeLessThan(
      markup.indexOf("Improvements"),
    );
    expect(markup.indexOf("Improvements")).toBeLessThan(
      markup.indexOf("Fixes"),
    );
    expect(markup.indexOf("Fixes")).toBeLessThan(markup.indexOf("Security"));
    const onlyFix = renderPage("en", [entries[1]]);
    expect(onlyFix).toContain("Fixes");
    expect(onlyFix).not.toContain("Features");
  });

  it("chooses each translated title independently and announces only actual fallbacks", () => {
    const german = renderPage("de");
    expect(german).toContain("Funktion");
    expect(german).toContain("Escape &lt;script&gt; &amp; quotes");
    expect(german).toContain("Einige Einträge sind noch nicht übersetzt");
    const fullyTranslated = renderPage(
      "de",
      entries.filter(({ title }) => title.de),
    );
    expect(fullyTranslated).not.toContain(
      "Einige Einträge sind noch nicht übersetzt",
    );
  });

  it("renders a localized empty state", () => {
    expect(renderPage("fr", [])).toContain(
      "Aucune entrée publique n’est encore disponible.",
    );
  });

  it("retains desktop and mobile-profile navigation entry points", () => {
    const onSelectModule = vi.fn();
    const navigation = renderToStaticMarkup(
      <I18nProvider>
        <ModuleTabs
          activeModule="dashboard"
          onSelectModule={onSelectModule}
          onOpenProfile={vi.fn()}
          theme="light"
          onToggleTheme={vi.fn()}
          isNavSlim={false}
          onToggleNavSlim={vi.fn()}
          onLogout={vi.fn()}
          isLoggingOut={false}
        />
      </I18nProvider>,
    );
    expect(navigation).toContain("changelog-navigation");
    expect(navigation).toContain('aria-label="What&#x27;s new"');
    const profileSource = readFileSync(
      "app/components/logbook/pages/ProfilePage.tsx",
      "utf8",
    );
    expect(profileSource).toContain('navigate("changelog")');
    expect(profileSource).toContain('t("nav.changelog")');
  });
});

import releaseArtifact from "../content/releases.json";
import { parseReleaseData, type ChangelogEntry, type Release, type ReleaseData } from "../content/releases";
import { t as translate, useI18n, type Locale, type TranslationKey } from "../lib/i18n";

const generatedReleases = parseReleaseData(releaseArtifact);
const categories = ["feature", "improvement", "fix", "security"] as const;
const categoryKeys: Record<(typeof categories)[number], TranslationKey> = {
  feature: "changelog.category.feature",
  improvement: "changelog.category.improvement",
  fix: "changelog.category.fix",
  security: "changelog.category.security",
};

const localeTags: Record<Locale, string> = { en: "en-US", de: "de-DE", fr: "fr-FR", it: "it-IT" };

export function localizedEntryTitle(entry: ChangelogEntry, locale: Locale) {
  return entry.title[locale] ?? entry.title.en;
}

function ReleaseEntries({ release, locale }: { release: Release; locale: Locale }) {
  const t = (key: TranslationKey) => translate(locale, key);
  if (release.entries.length === 0) return <p className="changelog-empty">{t("changelog.noChanges")}</p>;
  return <div className="changelog-categories">{categories.map((category) => {
    const entries = release.entries.filter((entry) => entry.category === category);
    if (!entries.length) return null;
    return <section key={category} aria-labelledby={`${release.version}-${category}`}>
      <h3 id={`${release.version}-${category}`}>{t(categoryKeys[category])}</h3>
      <ul>{entries.map((entry) => <li key={entry.prNumber}>
        <span>{localizedEntryTitle(entry, locale)}</span>{" "}
        <a href={entry.prUrl} target="_blank" rel="noreferrer" aria-label={`${t("changelog.prLink")} #${entry.prNumber}`}>#{entry.prNumber}</a>
      </li>)}</ul>
    </section>;
  })}</div>;
}

function ReleaseSection({ release, locale, current = false }: { release: Release; locale: Locale; current?: boolean }) {
  const t = (key: TranslationKey) => translate(locale, key);
  const date = new Intl.DateTimeFormat(localeTags[locale], { dateStyle: "long", timeZone: "UTC" }).format(new Date(release.releasedAt));
  return <article className={`changelog-release${current ? " current" : ""}`}>
    <header><div><p className="eyebrow">{current ? t("changelog.current") : t("changelog.release")}</p><h2>v{release.version}</h2></div><time dateTime={release.releasedAt}>{date}</time></header>
    <ReleaseEntries release={release} locale={locale} />
  </article>;
}

export function ChangelogPage({ releases = generatedReleases, localeOverride }: { releases?: ReleaseData; localeOverride?: Locale }) {
  const i18n = useI18n();
  const locale = localeOverride ?? i18n.locale;
  const t = (key: TranslationKey) => translate(locale, key);
  const [current, ...recent] = releases;
  return <section className="changelog-page module-panel" aria-label={t("changelog.aria")}>
    <div className="page-heading"><div><p className="eyebrow">{t("changelog.eyebrow")}</p><h1>{t("changelog.title")}</h1><p>{t("changelog.subtitle")}</p></div></div>
    {locale !== "en" && <p className="changelog-language-notice" role="note">{t("changelog.englishNotice")}</p>}
    {!current ? <p className="changelog-empty">{t("changelog.noReleases")}</p> : <>
      <ReleaseSection release={current} locale={locale} current />
      <h2 className="changelog-recent-title">{t("changelog.recent")}</h2>
      {recent.length ? recent.map((release) => <ReleaseSection key={release.version} release={release} locale={locale} />) : <p className="changelog-empty">{t("changelog.noRecent")}</p>}
    </>}
  </section>;
}

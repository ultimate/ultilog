"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  GeneratedChangelogEntry,
  ChangelogCategory,
} from "../content/changelog";
import { parseGeneratedChangelog } from "../content/changelog";
import {
  t as translate,
  useI18n,
  type Locale,
  type TranslationKey,
} from "../lib/i18n";

const categoryOrder: ChangelogCategory[] = [
  "feature",
  "improvement",
  "fix",
  "security",
];

type ChangelogPageProps = {
  entries?: GeneratedChangelogEntry[];
  locale?: Locale;
};

type DateGroup = {
  date: string;
  entries: GeneratedChangelogEntry[];
};

export function ChangelogPage({
  entries: suppliedEntries,
  locale: suppliedLocale,
}: ChangelogPageProps) {
  const { locale: contextLocale } = useI18n();
  const locale = suppliedLocale ?? contextLocale;
  const t = (key: TranslationKey) => translate(locale, key);
  const [loadedEntries, setLoadedEntries] = useState<GeneratedChangelogEntry[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(suppliedEntries === undefined);

  useEffect(() => {
    if (suppliedEntries !== undefined) return;
    const controller = new AbortController();
    fetch("/generated/changelog.json", { signal: controller.signal })
      .then((response) =>
        response.ok
          ? response.json()
          : Promise.reject(new Error(String(response.status))),
      )
      .then((value: unknown) =>
        setLoadedEntries(parseGeneratedChangelog(value)),
      )
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError"))
          setLoadedEntries([]);
      })
      .finally(() => setIsLoading(false));
    return () => controller.abort();
  }, [suppliedEntries]);

  const displayedEntries = suppliedEntries ?? loadedEntries;
  const groups = useMemo(
    () => groupByIntroduction(displayedEntries),
    [displayedEntries],
  );
  const usesEnglishFallback =
    locale !== "en" &&
    displayedEntries.some((entry) => entry.title[locale] === undefined);

  return (
    <section
      className="changelog-page module-panel"
      aria-label={t("changelog.aria")}
    >
      <div className="page-heading">
        <div>
          <p className="eyebrow">{t("changelog.eyebrow")}</p>
          <h1>{t("changelog.title")}</h1>
          <p>{t("changelog.subtitle")}</p>
        </div>
      </div>
      {usesEnglishFallback ? (
        <p className="changelog-fallback" role="note">
          {t("changelog.englishFallback")}
        </p>
      ) : null}
      {isLoading ? <p role="status">{t("changelog.loading")}</p> : null}
      {!isLoading && groups.length === 0 ? (
        <p className="empty-state">{t("changelog.empty")}</p>
      ) : null}
      <div className="changelog-groups">
        {groups.map((group) => (
          <article className="changelog-group" key={group.date}>
            <header>
              <h2>
                <time dateTime={group.date}>
                  {new Intl.DateTimeFormat(locale, {
                    dateStyle: "long",
                    timeZone: "UTC",
                  }).format(new Date(`${group.date}T00:00:00Z`))}
                </time>
              </h2>
            </header>
            {categoryOrder.map((category) => {
              const categoryEntries = group.entries.filter(
                (entry) => entry.category === category,
              );
              if (categoryEntries.length === 0) return null;
              return (
                <section
                  className="changelog-category"
                  key={category}
                  aria-labelledby={`${group.date}-${category}`}
                >
                  <h3 id={`${group.date}-${category}`}>
                    {t(`changelog.category.${category}`)}
                  </h3>
                  <ul>
                    {categoryEntries.map((entry) => (
                      <li key={entry.id}>
                        {entry.title[locale] ?? entry.title.en}{" "}
                        <code className="changelog-commit" title={entry.introduction.commitSha}>{entry.introduction.shortSha}</code>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </article>
        ))}
      </div>
    </section>
  );
}

export function groupByIntroduction(
  entries: GeneratedChangelogEntry[],
): DateGroup[] {
  const groups = new Map<string, DateGroup>();
  for (const entry of entries) {
    const date = new Date(entry.introduction.introducedAt).toISOString().slice(0, 10);
    const group = groups.get(date) ?? { date, entries: [] };
    group.entries.push(entry);
    groups.set(date, group);
  }
  return [...groups.values()]
    .sort((left, right) => right.date.localeCompare(left.date))
    .map((group) => ({
      ...group,
      entries: [...group.entries].sort(
        (left, right) =>
          categoryOrder.indexOf(left.category) -
            categoryOrder.indexOf(right.category) ||
          left.id.localeCompare(right.id),
      ),
    }));
}

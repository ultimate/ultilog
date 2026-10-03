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

type CommitGroup = {
  commitSha: string;
  shortSha: string;
  introducedAt: string;
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
          <article className="changelog-group" key={group.commitSha}>
            <header>
              <h2>
                <code>{group.shortSha}</code>
              </h2>
              <time dateTime={group.introducedAt}>
                {new Intl.DateTimeFormat(locale, {
                  dateStyle: "long",
                  timeZone: "UTC",
                }).format(new Date(group.introducedAt))}
              </time>
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
                  aria-labelledby={`${group.commitSha}-${category}`}
                >
                  <h3 id={`${group.commitSha}-${category}`}>
                    {t(`changelog.category.${category}`)}
                  </h3>
                  <ul>
                    {categoryEntries.map((entry) => (
                      <li key={entry.id}>
                        {entry.title[locale] ?? entry.title.en}
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
): CommitGroup[] {
  const groups = new Map<string, CommitGroup>();
  for (const entry of entries) {
    const { commitSha, shortSha, introducedAt } = entry.introduction;
    const group = groups.get(commitSha) ?? {
      commitSha,
      shortSha,
      introducedAt,
      entries: [],
    };
    group.entries.push(entry);
    groups.set(commitSha, group);
  }
  return [...groups.values()]
    .sort(
      (left, right) =>
        right.introducedAt.localeCompare(left.introducedAt) ||
        right.commitSha.localeCompare(left.commitSha),
    )
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

"use client";

import type { BuildInfo } from "../lib/build-info-types";
import { isAllowedDeploymentUrl } from "../lib/build-info-types";
import type { Locale } from "../lib/i18n";
import styles from "./BuildIdentity.module.css";

type BuildIdentityProps = {
  buildInfo: BuildInfo;
  locale?: Locale;
  className?: string;
};

const labels = {
  production: "PRODUCTION",
  preview: "PREVIEW",
  staging: "STAGING",
  development: "DEVELOPMENT",
} as const;

function localizedDate(
  timestamp: string | undefined,
  locale: Locale,
): string | undefined {
  if (timestamp === undefined) return undefined;
  const date = new Date(timestamp);
  if (Number.isNaN(date.valueOf())) return undefined;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
}

export function BuildIdentity({
  buildInfo,
  locale = "en",
  className,
}: BuildIdentityProps) {
  const shortSha = buildInfo.commitSha?.slice(0, 7);
  const date = localizedDate(buildInfo.commitTimestamp, locale);
  const environmentName =
    buildInfo.environment === "staging" && buildInfo.targetEnvironment
      ? `${labels.staging} / ${buildInfo.targetEnvironment.toUpperCase()}`
      : labels[buildInfo.environment];
  const deploymentUrl =
    buildInfo.deploymentUrl && isAllowedDeploymentUrl(buildInfo.deploymentUrl)
      ? buildInfo.deploymentUrl
      : undefined;
  const hasDiagnostics =
    buildInfo.commitSha !== undefined || deploymentUrl !== undefined;

  const visibleIdentity = (
    <>
      {buildInfo.environment !== "production" && buildInfo.branch ? (
        <span className={styles.branch} title={buildInfo.branch}>
          {buildInfo.branch}
        </span>
      ) : null}
      {shortSha ? <code className={styles.sha}>{shortSha}</code> : null}
      {date ? <span className={styles.date}>[{date}]</span> : null}
    </>
  );

  return (
    <span
      className={[styles.root, className].filter(Boolean).join(" ")}
      data-environment={buildInfo.environment}
    >
      <span className={`${styles.label} ${styles[buildInfo.environment]}`}>
        {environmentName}
      </span>
      {hasDiagnostics ? (
        <details className={styles.details}>
          <summary
            className={styles.summary}
            aria-label="Show build diagnostics"
          >
            {visibleIdentity}
          </summary>
          <span className={styles.diagnostics}>
            {buildInfo.commitSha ? (
              <span>
                Commit: <code>{buildInfo.commitSha}</code>
              </span>
            ) : null}
            {deploymentUrl ? (
              <a href={deploymentUrl} target="_blank" rel="noopener noreferrer">
                Open deployment
              </a>
            ) : null}
          </span>
        </details>
      ) : (
        <span className={styles.summary}>{visibleIdentity}</span>
      )}
    </span>
  );
}

import type { BuildInfo } from "../lib/build-info-types";

type BuildIdentityProps = {
  buildInfo: BuildInfo;
  placement?: "sidebar" | "profile";
  onOpenChangelog?: () => void;
};

const environmentLabel = (environment: BuildInfo["environment"]) => ({
  production: "Production",
  preview: "Preview",
  staging: "Staging",
  development: "Development",
})[environment];

export function isTrustedDeploymentUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "vercel.app" || url.hostname.endsWith(".vercel.app"));
  } catch {
    return false;
  }
}

function IdentitySummary({ buildInfo }: { buildInfo: BuildInfo }) {
  const label = buildInfo.environment === "staging" && buildInfo.targetEnvironment
    ? buildInfo.targetEnvironment
    : environmentLabel(buildInfo.environment);
  if (buildInfo.environment === "production") {
    return <span className="build-identity-line" aria-label={`${label} build v${buildInfo.version}`}><strong className="build-environment-label">PRODUCTION</strong><code>v{buildInfo.version}</code></span>;
  }

  const shortSha = buildInfo.commitSha?.slice(0, 7);
  return (
    <span className="build-identity-line" aria-label={`${label} build${buildInfo.branch ? ` from branch ${buildInfo.branch}` : ""}${shortSha ? ` at commit ${shortSha}` : ""}`}>
      <strong className="build-environment-label">{label.toUpperCase()}</strong>
      {buildInfo.branch && <span className="build-branch" title={buildInfo.branch}>{buildInfo.branch}</span>}
      {shortSha && <code>{shortSha}</code>}
    </span>
  );
}

/** Compact, non-editable deployment identity and optional diagnostics. */
export function BuildIdentity({ buildInfo, placement = "sidebar", onOpenChangelog }: BuildIdentityProps) {
  const hasDiagnostics = Boolean(buildInfo.commitSha || buildInfo.deploymentUrl);
  const className = `build-identity build-identity--${buildInfo.environment} build-identity--${placement}`;

  if (buildInfo.environment === "production" && onOpenChangelog) {
    return <button type="button" className={`${className} build-identity-open`} onClick={onOpenChangelog}><IdentitySummary buildInfo={buildInfo} /></button>;
  }
  if (!hasDiagnostics) return <div className={className}><IdentitySummary buildInfo={buildInfo} /></div>;

  return (
    <details className={className}>
      <summary><IdentitySummary buildInfo={buildInfo} /><span className="build-details-hint">Details</span></summary>
      <dl className="build-diagnostics">
        {buildInfo.commitSha && <div><dt>Commit</dt><dd><code>{buildInfo.commitSha}</code></dd></div>}
        {buildInfo.deploymentUrl && <div><dt>Deployment</dt><dd>{isTrustedDeploymentUrl(buildInfo.deploymentUrl)
          ? <a href={buildInfo.deploymentUrl} target="_blank" rel="noreferrer">{buildInfo.deploymentUrl}</a>
          : <span>{buildInfo.deploymentUrl}</span>}</dd></div>}
      </dl>
    </details>
  );
}

import "server-only";

import { parseBuildInfo, parseReleaseVersion, type BuildInfo } from "./build-info-types";

type BuildEnvironmentVariables = Readonly<Record<string, string | undefined>>;

const value = (environment: BuildEnvironmentVariables, name: string) => {
  const candidate = environment[name]?.trim();
  return candidate ? candidate : undefined;
};

const deploymentUrl = (environment: BuildEnvironmentVariables) => {
  const candidate = value(environment, "VERCEL_URL") ?? value(environment, "VERCEL_BRANCH_URL");
  if (!candidate) return undefined;
  return /^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`;
};

const previewIdentity = (branch?: string, commitSha?: string) =>
  [branch, commitSha].filter((component): component is string => component !== undefined).join("@");

/**
 * Normalize the deployment environment into the only metadata object that may
 * cross the server/client boundary. Values not explicitly selected here are
 * never exposed to client components.
 */
export function buildInfoFromEnvironment(environment: BuildEnvironmentVariables): BuildInfo {
  const vercelEnvironment = value(environment, "VERCEL_TARGET_ENV") ?? value(environment, "VERCEL_ENV");
  const isVercel = value(environment, "VERCEL") === "1" || vercelEnvironment !== undefined;
  if (!isVercel || vercelEnvironment === undefined || vercelEnvironment === "development") {
    return parseBuildInfo({ environment: "development", identity: "development" });
  }

  const branch = value(environment, "VERCEL_GIT_COMMIT_REF");
  const fullCommitSha = value(environment, "VERCEL_GIT_COMMIT_SHA");
  const commitSha = fullCommitSha && /^[0-9a-f]{7,64}$/i.test(fullCommitSha) ? fullCommitSha : undefined;
  const common = {
    ...(branch ? { branch } : {}),
    ...(commitSha ? { commitSha } : {}),
    targetEnvironment: vercelEnvironment,
    ...(deploymentUrl(environment) ? { deploymentUrl: deploymentUrl(environment) } : {}),
  };

  if (vercelEnvironment === "production") {
    const version = parseReleaseVersion(value(environment, "BUILD_VERSION"));
    return parseBuildInfo({ environment: "production", identity: version, version, ...common });
  }

  const normalizedEnvironment = vercelEnvironment === "preview" ? "preview" : "staging";
  const identity = previewIdentity(common.branch, common.commitSha?.slice(0, 7));
  return parseBuildInfo({
    environment: normalizedEnvironment,
    ...(identity ? { identity } : {}),
    ...common,
  });
}

// Evaluate during server module initialization so a malformed production
// deployment fails the build rather than becoming a request-time surprise.
const currentBuildInfo = buildInfoFromEnvironment(process.env);

/** Read normalized server-side deployment metadata. */
export function getBuildInfo(): BuildInfo {
  return currentBuildInfo;
}

import {
  parseBuildInfo,
  type BuildEnvironment,
  type BuildInfo,
} from "./build-info-types";

type BuildEnvironmentVariables = {
  VERCEL?: string;
  VERCEL_ENV?: string;
  VERCEL_TARGET_ENV?: string;
  VERCEL_GIT_COMMIT_REF?: string;
  VERCEL_GIT_COMMIT_SHA?: string;
  VERCEL_GIT_COMMIT_TIMESTAMP?: string;
  VERCEL_URL?: string;
  [key: string]: string | undefined;
};

const present = (value: string | undefined): string | undefined => {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
};

function deploymentEnvironment(
  source: BuildEnvironmentVariables,
): BuildEnvironment {
  const vercelEnvironment = present(source.VERCEL_ENV)?.toLowerCase();
  if (vercelEnvironment === "production") return "production";
  if (vercelEnvironment === "development") return "development";

  if (vercelEnvironment === "preview") {
    const target = present(source.VERCEL_TARGET_ENV)?.toLowerCase();
    return target !== undefined &&
      target !== "preview" &&
      target !== "production"
      ? "staging"
      : "preview";
  }

  // NODE_ENV=production also describes local and generic framework builds. It
  // must not grant them a production deployment identity.
  return "development";
}

/**
 * Read only the platform fields that are safe to expose. No arbitrary process
 * environment values or secrets can enter the returned object.
 */
export function getBuildInfo(
  source: BuildEnvironmentVariables = process.env,
): BuildInfo {
  const environment = deploymentEnvironment(source);
  const branch = present(source.VERCEL_GIT_COMMIT_REF);
  const commitSha = present(source.VERCEL_GIT_COMMIT_SHA);
  const rawTarget = present(source.VERCEL_TARGET_ENV);
  const targetEnvironment = environment === "staging" ? rawTarget : undefined;
  const commitTimestamp = present(source.VERCEL_GIT_COMMIT_TIMESTAMP);
  const deploymentHost = present(source.VERCEL_URL);
  const deploymentUrl =
    deploymentHost === undefined
      ? undefined
      : `https://${deploymentHost.replace(/^https:\/\//i, "")}`;

  return parseBuildInfo({
    environment,
    ...(branch === undefined ? {} : { branch }),
    ...(commitSha === undefined ? {} : { commitSha }),
    ...(targetEnvironment === undefined ? {} : { targetEnvironment }),
    ...(commitTimestamp === undefined ? {} : { commitTimestamp }),
    ...(deploymentUrl === undefined ? {} : { deploymentUrl }),
  });
}

export const BUILD_ENVIRONMENTS = ["production", "preview", "staging", "development"] as const;

export type BuildEnvironment = (typeof BUILD_ENVIRONMENTS)[number];

/** A UTC-date release identifier (`yyMMdd.suffix`), without the Git tag's `v` prefix. */
export type ReleaseVersion = string & { readonly __releaseVersion: unique symbol };

type DeploymentMetadata = {
  identity?: string;
  branch?: string;
  commitSha?: string;
  targetEnvironment?: string;
  deploymentUrl?: string;
};

export type BuildInfo =
  | (DeploymentMetadata & { environment: "production"; version: ReleaseVersion })
  | (DeploymentMetadata & { environment: "preview"; version?: ReleaseVersion })
  | (DeploymentMetadata & { environment: "staging"; version?: ReleaseVersion })
  | (DeploymentMetadata & { environment: "development"; version?: ReleaseVersion });

const releaseVersionPattern = /^(\d{2})(\d{2})(\d{2})\.(0|[1-9]\d*)$/;

const shaPattern = /^[0-9a-f]{7,64}$/i;
const buildEnvironments = new Set<string>(BUILD_ENVIRONMENTS);

export const isReleaseVersion = (value: unknown): value is ReleaseVersion => {
  if (typeof value !== "string") return false;
  const match = value.match(releaseVersionPattern);
  if (match === null) return false;

  const year = 2000 + Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

export function parseReleaseVersion(value: unknown): ReleaseVersion {
  if (!isReleaseVersion(value)) throw new TypeError("Invalid release version: expected yyMMdd.suffix");
  return value;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const optionalNonEmptyString = (source: Record<string, unknown>, key: string): string | undefined => {
  const value = source[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.trim() === "") throw new TypeError(`Invalid build info ${key}`);
  return value;
};

/** Validate untrusted, generated build metadata before exposing it to the application. */
export function parseBuildInfo(value: unknown): BuildInfo {
  if (!isRecord(value) || typeof value.environment !== "string" || !buildEnvironments.has(value.environment)) {
    throw new TypeError("Invalid build environment");
  }

  const version = value.version === undefined ? undefined : parseReleaseVersion(value.version);
  if (value.environment === "production" && version === undefined) {
    throw new TypeError("Production builds require a release version");
  }
  if (value.environment === "preview" && version !== undefined) {
    throw new TypeError("Preview builds cannot claim a production release version");
  }

  const branch = optionalNonEmptyString(value, "branch");
  const identity = optionalNonEmptyString(value, "identity");
  if (value.environment === "production" && identity !== undefined && identity !== version) {
    throw new TypeError("Production build identity must match its release version");
  }
  const commitSha = optionalNonEmptyString(value, "commitSha");
  if (commitSha !== undefined && !shaPattern.test(commitSha)) throw new TypeError("Invalid build info commitSha");
  const targetEnvironment = optionalNonEmptyString(value, "targetEnvironment");
  const deploymentUrl = optionalNonEmptyString(value, "deploymentUrl");
  if (deploymentUrl !== undefined) {
    try {
      const url = new URL(deploymentUrl);
      if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error();
    } catch {
      throw new TypeError("Invalid build info deploymentUrl");
    }
  }

  return {
    environment: value.environment,
    ...(identity === undefined ? {} : { identity }),
    ...(version === undefined ? {} : { version }),
    ...(branch === undefined ? {} : { branch }),
    ...(commitSha === undefined ? {} : { commitSha }),
    ...(targetEnvironment === undefined ? {} : { targetEnvironment }),
    ...(deploymentUrl === undefined ? {} : { deploymentUrl }),
  } as BuildInfo;
}

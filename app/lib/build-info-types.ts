export const BUILD_ENVIRONMENTS = ["production", "preview", "staging", "development"] as const;

export type BuildEnvironment = (typeof BUILD_ENVIRONMENTS)[number];

/** A SemVer release identifier. The `v` used by some Git tags is deliberately not part of it. */
export type ReleaseVersion = string & { readonly __releaseVersion: unique symbol };

type DeploymentMetadata = {
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

// SemVer 2.0.0, including optional pre-release and build identifiers.
const releaseVersionPattern =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

const shaPattern = /^[0-9a-f]{7,64}$/i;
const buildEnvironments = new Set<string>(BUILD_ENVIRONMENTS);

export const isReleaseVersion = (value: unknown): value is ReleaseVersion =>
  typeof value === "string" && releaseVersionPattern.test(value);

export function parseReleaseVersion(value: unknown): ReleaseVersion {
  if (!isReleaseVersion(value)) throw new TypeError("Invalid release version: expected a SemVer version");
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

  const branch = optionalNonEmptyString(value, "branch");
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
    ...(version === undefined ? {} : { version }),
    ...(branch === undefined ? {} : { branch }),
    ...(commitSha === undefined ? {} : { commitSha }),
    ...(targetEnvironment === undefined ? {} : { targetEnvironment }),
    ...(deploymentUrl === undefined ? {} : { deploymentUrl }),
  } as BuildInfo;
}

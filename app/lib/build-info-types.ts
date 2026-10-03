export const BUILD_ENVIRONMENTS = [
  "production",
  "preview",
  "staging",
  "development",
] as const;

export type BuildEnvironment = (typeof BUILD_ENVIRONMENTS)[number];

type DeploymentMetadata = {
  /** Normalized source branch; never an arbitrary environment value. */
  branch?: string;
  /** A validated Git SHA. Production always contains all 40 characters. */
  commitSha?: string;
  /** Vercel custom-environment name, when applicable. */
  targetEnvironment?: string;
  /** UTC commit time used for localized, non-authoritative display. */
  commitTimestamp?: string;
  /** Validated HTTPS URL for this deployment. */
  deploymentUrl?: string;
};

export type BuildInfo = DeploymentMetadata & {
  environment: BuildEnvironment;
  /** Compact, derived display value; it is not accepted as input metadata. */
  identity?: string;
};

const fullShaPattern = /^[0-9a-f]{40}$/;
const deployShaPattern = /^[0-9a-f]{7,40}$/;
const environments = new Set<string>(BUILD_ENVIRONMENTS);
const fields = new Set([
  "environment",
  "branch",
  "commitSha",
  "targetEnvironment",
  "commitTimestamp",
  "deploymentUrl",
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const optionalString = (
  source: Record<string, unknown>,
  key: string,
): string | undefined => {
  const value = source[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.trim() === "")
    throw new TypeError(`Invalid build info ${key}`);
  return value.trim();
};

function compactBranch(branch: string): string {
  const maximumLength = 32;
  return branch.length <= maximumLength
    ? branch
    : `${branch.slice(0, maximumLength - 1)}…`;
}

function displayIdentity(
  branch: string | undefined,
  commitSha: string | undefined,
): string | undefined {
  const components = [
    branch === undefined ? undefined : compactBranch(branch),
    commitSha?.slice(0, 7),
  ].filter((component): component is string => component !== undefined);
  return components.length === 0 ? undefined : components.join("@");
}

/** Validate generated metadata and derive the only identity exposed to UI code. */
export function parseBuildInfo(value: unknown): BuildInfo {
  if (!isRecord(value)) throw new TypeError("Build info must be an object");
  const unexpected = Object.keys(value).find((field) => !fields.has(field));
  if (unexpected !== undefined)
    throw new TypeError(`Unexpected build info field: ${unexpected}`);
  if (
    typeof value.environment !== "string" ||
    !environments.has(value.environment)
  ) {
    throw new TypeError("Invalid build environment");
  }

  const environment = value.environment as BuildEnvironment;
  const branch = optionalString(value, "branch");
  const rawSha = optionalString(value, "commitSha");
  const commitSha = rawSha?.toLowerCase();
  let targetEnvironment = optionalString(value, "targetEnvironment");
  const commitTimestamp = optionalString(value, "commitTimestamp");
  const deploymentUrl = optionalString(value, "deploymentUrl");

  if (environment === "production") {
    if (commitSha === undefined)
      throw new TypeError("Production builds require a full commit SHA");
    if (!fullShaPattern.test(commitSha))
      throw new TypeError("Production builds require a valid full commit SHA");
  } else if (commitSha !== undefined && !deployShaPattern.test(commitSha)) {
    throw new TypeError("Invalid build info commitSha");
  }

  // Non-production builds may never present themselves as production through
  // platform-supplied custom-environment metadata.
  if (
    environment !== "production" &&
    targetEnvironment?.toLowerCase() === "production"
  ) {
    targetEnvironment = undefined;
  }

  if (commitTimestamp !== undefined) {
    const timestamp = new Date(commitTimestamp);
    if (
      Number.isNaN(timestamp.valueOf()) ||
      timestamp.toISOString() !== commitTimestamp
    ) {
      throw new TypeError("Invalid build info commitTimestamp");
    }
  }
  if (deploymentUrl !== undefined && !isAllowedDeploymentUrl(deploymentUrl)) {
    throw new TypeError("Invalid build info deploymentUrl");
  }

  const identity =
    environment === "production"
      ? commitSha!.slice(0, 7)
      : displayIdentity(branch, commitSha);
  return {
    environment,
    ...(branch === undefined ? {} : { branch }),
    ...(commitSha === undefined ? {} : { commitSha }),
    ...(targetEnvironment === undefined ? {} : { targetEnvironment }),
    ...(commitTimestamp === undefined ? {} : { commitTimestamp }),
    ...(deploymentUrl === undefined ? {} : { deploymentUrl }),
    ...(identity === undefined ? {} : { identity }),
  };
}

/** Deployment diagnostics may link only to Vercel's HTTPS deployment hosts. */
export function isAllowedDeploymentUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.username === "" &&
      url.password === "" &&
      url.port === "" &&
      url.hostname.endsWith(".vercel.app") &&
      url.pathname === "/" &&
      url.search === "" &&
      url.hash === ""
    );
  } catch {
    return false;
  }
}

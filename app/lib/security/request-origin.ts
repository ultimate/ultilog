import { NextResponse } from "next/server";

/**
 * Enforces the CSRF boundary for cookie-authenticated mutations.
 *
 * Browsers must send an Origin matching the configured public application URL.
 * Originless requests are accepted only when they carry no cookies; this lets
 * endpoints with an explicit Bearer credential support trusted non-browser
 * automation. Session cookies are deliberately not an API-client credential.
 */
export function guardMutationOrigin(request: Request): NextResponse | undefined {
  const supplied = request.headers.get("origin");
  if (!supplied) {
    if (request.headers.has("cookie") || request.headers.has("sec-fetch-site")) {
      return rejectedOrigin();
    }
    return undefined;
  }

  let parsed: URL;
  try {
    parsed = new URL(supplied);
  } catch {
    return rejectedOrigin();
  }

  // Origin is a serialized origin, never a URL containing credentials, paths,
  // query strings, or fragments. URL.origin also normalizes default ports.
  if (supplied !== parsed.origin || !allowedApplicationOrigins().has(parsed.origin)) {
    return rejectedOrigin();
  }
  return undefined;
}

/**
 * Every hostname in this set comes from deployment configuration, rather than
 * request-controlled forwarding headers. Vercel gives preview deployments a
 * unique VERCEL_URL in addition to the stable branch and production aliases.
 */
export function allowedApplicationOrigins() {
  const origins = new Set([canonicalApplicationOrigin()]);
  for (const configured of [
    process.env.NEXT_PUBLIC_APP_URL,
    vercelUrl(process.env.VERCEL_URL),
    vercelUrl(process.env.VERCEL_BRANCH_URL),
    vercelUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL),
    process.env.AUTH_URL,
    process.env.NEXTAUTH_URL,
  ]) {
    if (!configured) continue;
    try { origins.add(new URL(configured).origin); } catch { /* canonicalApplicationOrigin validates the selected primary URL. */ }
  }
  return origins;
}

export function canonicalApplicationOrigin() {
  const configured = process.env.NEXT_PUBLIC_APP_URL
    || vercelUrl(process.env.VERCEL_BRANCH_URL)
    || process.env.AUTH_URL
    || process.env.NEXTAUTH_URL
    || "http://localhost:3000";
  try {
    return new URL(configured).origin;
  } catch {
    throw new Error("The canonical application URL is invalid.");
  }
}

function vercelUrl(value: string | undefined) {
  if (!value) return undefined;
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function rejectedOrigin() {
  return NextResponse.json(
    { error: "Request origin is not allowed.", code: "invalid_origin" },
    { status: 403 },
  );
}

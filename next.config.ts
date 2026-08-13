import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

function contentSecurityPolicy(developmentServer: boolean) {
  return [
    "default-src 'self'",
    // Next's static bootstrap currently emits inline scripts without exposing a
    // nonce to next.config headers. Keep this exception confined to scripts;
    // third-party script origins remain forbidden. React's development runtime
    // uses eval to reconstruct debugging call stacks, so permit it only when
    // Next is explicitly running its development server.
    `script-src 'self' 'unsafe-inline'${developmentServer ? " 'unsafe-eval'" : ""}`,
    // Leaflet positions map panes and markers with element style attributes, and
    // the print view emits scoped inline CSS.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://*.tile.openstreetmap.org https://tiles.openseamap.org https://www.gravatar.com",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
    "form-action 'self'",
  ].join("; ");
}

export function securityHeaders(productionHttps: boolean, developmentServer = false) {
  const headers = [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(developmentServer) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    },
    // Legacy fallback for clients that do not implement frame-ancestors.
    { key: "X-Frame-Options", value: "DENY" },
  ];

  if (productionHttps) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    });
  }

  return headers;
}

function isProductionHttpsDeployment() {
  if (process.env.NODE_ENV !== "production") return false;
  if (process.env.VERCEL === "1") return true;

  return [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.AUTH_URL,
    process.env.NEXTAUTH_URL,
  ].some((url) => url?.startsWith("https://"));
}

export default function nextConfig(phase: string): NextConfig {
  const developmentServer = phase === PHASE_DEVELOPMENT_SERVER;

  return {
    reactStrictMode: true,
    async headers() {
      return [
        {
          // Applying the common policy here protects rendered pages, static
          // assets, and API responses (including error responses) consistently.
          source: "/:path*",
          headers: securityHeaders(isProductionHttpsDeployment(), developmentServer),
        },
      ];
    },
  };
}

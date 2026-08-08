import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { NextRequest } from "next/server";
import { consumeDemoSandboxLogin } from "./app/lib/demo/demo-sandboxes";
import { isDemoSandboxSessionExpired } from "./app/lib/demo/demo-session";
import { validateUser } from "./app/lib/users";
import { enforceRateLimits, normalizeEmail, rateLimitResponse, requestIp, securityEvent } from "./app/lib/security/rate-limiter";

const nextAuth = NextAuth({
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        demoToken: { label: "Demo token", type: "text" },
      },
      async authorize(credentials) {
        if (typeof credentials?.demoToken === "string") return consumeDemoSandboxLogin(credentials.demoToken);
        const email = typeof credentials?.email === "string" ? credentials.email : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        const user = await validateUser(email, password);
        securityEvent(user ? "credentials_login_succeeded" : "credentials_login_failed", { emailDomain: normalizeEmail(email).split("@")[1] ?? "invalid" });
        return user;
      },
    }),
  ],
  callbacks: {
    authorized({ auth }) {
      return Boolean(auth?.user?.id) && !isDemoSandboxSessionExpired(auth?.user?.demoSandboxExpiresAt);
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.groups = user.groups ?? [];
        token.demoSandboxExpiresAt = user.demoSandboxExpiresAt;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        const isExpired = isDemoSandboxSessionExpired(token.demoSandboxExpiresAt);
        session.user.id = isExpired ? "" : token.id as string;
        // This snapshot supports UI presentation only and can become stale.
        // Protected server operations must resolve current entitlements from
        // the database rather than authorizing from session.user.groups.
        session.user.groups = isExpired ? [] : Array.isArray(token.groups) ? token.groups as string[] : [];
        session.user.demoSandboxExpiresAt = typeof token.demoSandboxExpiresAt === "string" ? token.demoSandboxExpiresAt : undefined;
      }
      return session;
    },
  },
  pages: { signIn: "/login" },
});

export const { auth, signIn, signOut } = nextAuth;

async function credentialsPost(request: NextRequest) {
  if (new URL(request.url).pathname.endsWith("/callback/credentials")) {
    const form = await request.clone().formData();
    const email = typeof form.get("email") === "string" ? String(form.get("email")) : "";
    if (email) {
      const limited = await enforceRateLimits([
        { rule: { name: "credentials-ip", limit: 20, windowMs: 15 * 60_000 }, principal: requestIp(request) },
        { rule: { name: "credentials-email", limit: 8, windowMs: 15 * 60_000 }, principal: normalizeEmail(email) },
      ]);
      if (limited) return rateLimitResponse(limited, "Too many sign-in attempts. Please try again later.");
    }
  }
  return nextAuth.handlers.POST(request);
}

export const handlers = { GET: nextAuth.handlers.GET, POST: credentialsPost };

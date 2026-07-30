import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { consumeDemoSandboxLogin } from "./app/lib/demo/demo-sandboxes";
import { isDemoSandboxSessionExpired } from "./app/lib/demo/demo-session";
import { validateUser } from "./app/lib/users";

export const { handlers, auth, signIn, signOut } = NextAuth({
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
        return validateUser(email, password);
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

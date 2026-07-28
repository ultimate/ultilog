import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { validateDemoUser, validateUser } from "./app/lib/users";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        demo: { label: "Demo", type: "text" },
      },
      async authorize(credentials) {
        if (credentials?.demo === "true") return validateDemoUser();
        const email = typeof credentials?.email === "string" ? credentials.email : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        return validateUser(email, password);
      },
    }),
  ],
  callbacks: {
    authorized({ auth }) {
      return !!auth?.user;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.groups = user.groups ?? [];
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        // This snapshot supports UI presentation only and can become stale.
        // Protected server operations must resolve current entitlements from
        // the database rather than authorizing from session.user.groups.
        session.user.groups = Array.isArray(token.groups) ? token.groups as string[] : [];
      }
      return session;
    },
  },
  pages: { signIn: "/login" },
});

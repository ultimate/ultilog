import NextAuth, { type DefaultSession, type DefaultUser } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & { id: string; groups: string[]; demoSandboxExpiresAt?: string };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    groups?: string[];
    demoSandboxExpiresAt?: string;
  }
}

declare module "next-auth" {
  interface User extends DefaultUser {
    groups?: string[];
    demoSandboxExpiresAt?: string;
  }
}

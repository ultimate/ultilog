"use client";

import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ModuleTabs } from "../../templates/ModuleTabs";

export function SharedPageNavigation({ user }: { user: { name?: string | null; email?: string | null; groups?: string[] } }) {
  const router = useRouter();
  return <ModuleTabs
    activeModule="users"
    onSelectModule={(module) => router.push(`/${module === "details" ? "logbooks" : module}`)}
    onOpenProfile={() => router.push("/profile")}
    theme="light"
    onToggleTheme={() => document.documentElement.dataset.theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark"}
    userEmail={user.email ?? undefined}
    userName={user.name ?? undefined}
    userGroups={user.groups ?? []}
    isNavSlim={false}
    onToggleNavSlim={() => undefined}
    onLogout={() => void signOut({ callbackUrl: "/" })}
    isLoggingOut={false}
  />;
}

import type { TranslationKey } from "../lib/i18n";

export const moduleTabs = [
  { id: "dashboard", labelKey: "nav.dashboard" },
  { id: "logbooks", labelKey: "nav.logbooks" },
  { id: "details", labelKey: "nav.details" },
  { id: "boats", labelKey: "nav.boats" },
  { id: "crew", labelKey: "nav.crew" },
  { id: "users", labelKey: "nav.users" },
  { id: "compliance", labelKey: "nav.compliance" },
] as const satisfies readonly { id: string; labelKey: TranslationKey }[];

export type ModuleTab = typeof moduleTabs[number]["id"];

export const moduleTabs = [
  { id: "dashboard", label: "Dashboard / statistics" },
  { id: "logbooks", label: "Logbook list" },
  { id: "details", label: "Logbook details" },
  { id: "boats", label: "Boat manager" },
  { id: "crew", label: "Crew manager" },
  { id: "users", label: "Users" },
  { id: "compliance", label: "Compliance" },
] as const;

export type ModuleTab = typeof moduleTabs[number]["id"];

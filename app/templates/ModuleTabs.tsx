import { moduleTabs, type ModuleTab } from "./app-shell";

type ModuleTabsProps = {
  activeModule: ModuleTab;
  onSelectModule: (module: ModuleTab) => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  userEmail?: string;
  onLogout: () => void;
  isLoggingOut: boolean;
};

const icons: Record<ModuleTab, string> = {
  dashboard: "⌂",
  logbooks: "▣",
  details: "↢",
  boats: "⚓",
  crew: "♙",
  compliance: "◎",
};

export function ModuleTabs({ activeModule, onSelectModule, theme, onToggleTheme, userEmail, onLogout, isLoggingOut }: ModuleTabsProps) {
  return (
    <aside className="app-sidebar" aria-label="Primary navigation">
      <div className="brand-mark" aria-label="ultilog"><span className="sail-logo">◢</span><strong>ultilog</strong></div>
      <nav className="module-tabs" aria-label="Business logic modules">
        {moduleTabs.map((tab) => (
          <button type="button" key={tab.id} className={activeModule === tab.id ? "active" : ""} onClick={() => onSelectModule(tab.id)}>
            <span aria-hidden="true">{icons[tab.id]}</span>{tab.label}
          </button>
        ))}
      </nav>
      <div className="sidebar-spacer" />
      <section className="sync-card" aria-label="Cloud sync status"><span>☁</span><strong>Cloud sync</strong><small>All data is securely stored in the cloud.</small><em>● All up to date</em></section>
      <button className="theme-toggle" type="button" onClick={onToggleTheme}>{theme === "dark" ? "☀ Light mode" : "☾ Dark mode"}</button>
      <button className="profile-card" type="button" onClick={onLogout} disabled={isLoggingOut} aria-label="Logout"><span>JD</span><strong>{isLoggingOut ? "Saving…" : "Jane Doe"}</strong><small>{userEmail ?? "jane@example.com"}</small></button>
    </aside>
  );
}

import { moduleTabs, type ModuleTab } from "./app-shell";

export type ActiveView = ModuleTab | "profile";

type ModuleTabsProps = {
  activeModule: ActiveView;
  onSelectModule: (module: ModuleTab) => void;
  onOpenProfile: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  userEmail?: string;
  onLogout: () => void;
  isLoggingOut: boolean;
};

const icons: Record<ModuleTab, string> = {
  dashboard: "⌂",
  logbooks: "▣",
  details: "+",
  boats: "⚓",
  crew: "♙",
  compliance: "☷",
};

const mobileLabels: Record<ModuleTab, string> = {
  dashboard: "Dashboard",
  logbooks: "Logbooks",
  details: "Entry",
  boats: "Boats",
  crew: "Crew",
  compliance: "More",
};

export function ModuleTabs({ activeModule, onSelectModule, onOpenProfile, theme, onToggleTheme, userEmail, onLogout, isLoggingOut }: ModuleTabsProps) {
  return (
    <aside className="app-sidebar" aria-label="Primary navigation">
      <div className="brand-mark" aria-label="ultilog"><span className="sail-logo">◢</span><strong>ultilog</strong></div>
      <nav className="module-tabs" aria-label="Business logic modules">
        {moduleTabs.map((tab) => (
          <button type="button" key={tab.id} className={activeModule === tab.id ? "active" : ""} onClick={() => onSelectModule(tab.id)}>
            <span className="tab-icon" aria-hidden="true">{icons[tab.id]}</span>
            <span className="desktop-label">{tab.label}</span>
            <span className="mobile-label">{mobileLabels[tab.id]}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-spacer" />
      <section className="sync-card" aria-label="Cloud sync status"><span>☁</span><strong>Cloud sync</strong><small>All data is securely stored in the cloud.</small><em>● All up to date</em></section>
      <button className="theme-toggle" type="button" onClick={onToggleTheme}>{theme === "dark" ? "☀ Light mode" : "☾ Dark mode"}</button>
      <button className={`profile-card ${activeModule === "profile" ? "active" : ""}`} type="button" onClick={onOpenProfile}><span>JD</span><strong>Jane Doe</strong><small>{userEmail ?? "jane@example.com"}</small></button>
      <button className="logout-chip" type="button" onClick={onLogout} disabled={isLoggingOut} aria-label="Logout">{isLoggingOut ? "Saving…" : "Logout"}</button>
      <div className="mobile-nav-actions">
        <button className="mobile-theme-action" type="button" onClick={onToggleTheme}><span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span><small>{theme === "dark" ? "Light" : "Dark"}</small></button>
        <button className={`mobile-profile-action ${activeModule === "profile" ? "active" : ""}`} type="button" onClick={onOpenProfile}><span aria-hidden="true">JD</span><small>Profile</small></button>
      </div>
    </aside>
  );
}

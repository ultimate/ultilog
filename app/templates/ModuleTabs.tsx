import Image from "next/image";
import { moduleTabs, type ModuleTab } from "./app-shell";

export type ActiveView = ModuleTab | "profile" | "admin";

type ModuleTabsProps = {
  activeModule: ActiveView;
  onSelectModule: (module: ActiveView) => void;
  onOpenProfile: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  userEmail?: string;
  userName?: string;
  userGroups?: string[];
  isNavSlim: boolean;
  onToggleNavSlim: () => void;
  onLogout: () => void;
  isLoggingOut: boolean;
};

const icons: Record<ModuleTab, string> = {
  dashboard: "/icons/icon_dashboard.svg",
  logbooks: "/icons/icon_logbook-list.svg",
  details: "/icons/icon_compass.svg",
  boats: "/icons/icon_boat.svg",
  crew: "/icons/icon_crew.svg",
  compliance: "/icons/icon_compliance.svg",
};

type NavigationItemsProps = {
  activeModule: ActiveView;
  isAdmin: boolean;
  onSelectModule: (module: ActiveView) => void;
};

function NavigationItems({ activeModule, isAdmin, onSelectModule }: NavigationItemsProps) {
  return (
    <>
      {moduleTabs.map((tab) => (
        <button type="button" key={tab.id} className={activeModule === tab.id ? "active" : ""} onClick={() => onSelectModule(tab.id)} aria-label={tab.label}>
          <span className="tab-icon" aria-hidden="true"><Image className="nav-svg-icon" src={icons[tab.id]} alt="" width={24} height={24} /></span>
          <span className="nav-label">{tab.label}</span>
        </button>
      ))}
      {isAdmin && <button type="button" className={activeModule === "admin" ? "active" : ""} onClick={() => onSelectModule("admin")} aria-label="User management"><span className="tab-icon" aria-hidden="true"><Image className="nav-svg-icon" src="/icons/icon_admin.svg" alt="" width={24} height={24} /></span><span className="nav-label">Admin</span></button>}
    </>
  );
}

export function ModuleTabs({ activeModule, onSelectModule, onOpenProfile, theme, onToggleTheme, userEmail, userName, userGroups = [], isNavSlim, onToggleNavSlim, onLogout, isLoggingOut }: ModuleTabsProps) {
  const isAdmin = userGroups.includes("admin");
  return (
    <>
      <aside className="app-sidebar side-navigation" aria-label="Primary navigation">
        <button className="nav-edge-toggle" type="button" onClick={onToggleNavSlim} aria-label={isNavSlim ? "Expand sidebar" : "Collapse sidebar"}>
          <span className="nav-edge-toggle-icon" aria-hidden="true" />
        </button>
        <div className="brand-row"><div className="brand-mark" aria-label="ultilog"><span className="sail-logo">◢</span><strong>ultilog</strong></div></div>
        <nav className={`module-tabs ${isAdmin ? "has-admin-tab" : ""}`} aria-label="Business logic modules">
          <NavigationItems activeModule={activeModule} isAdmin={isAdmin} onSelectModule={onSelectModule} />
        </nav>
        <div className="sidebar-spacer" />
        <section className="sync-icon-card" aria-label="Cloud sync status"><span className="sync-icon" aria-hidden="true" /></section>
        <div className="sidebar-control-row"><button className="theme-toggle" type="button" onClick={onToggleTheme}><span className="theme-icon" aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span><span>{theme === "dark" ? "Light" : "Dark"}</span></button></div>
        <button className={`profile-card ${activeModule === "profile" ? "active" : ""}`} type="button" onClick={onOpenProfile}><span><Image className="nav-svg-icon" src="/icons/icon_profile.svg" alt="" width={24} height={24} /></span><strong>{userName ?? "Profile"}</strong><small>{userEmail ?? "No email"}</small></button>
        <button className="logout-chip" type="button" onClick={onLogout} disabled={isLoggingOut} aria-label="Logout">{isLoggingOut ? "Saving…" : "Logout"}</button>
      </aside>
      <nav className={`mobile-bottom-nav ${isAdmin ? "has-admin-tab" : ""}`} aria-label="Primary navigation">
        <NavigationItems activeModule={activeModule} isAdmin={isAdmin} onSelectModule={onSelectModule} />
        <button className="mobile-sync-action" type="button" disabled aria-label="All data is synced"><span className="sync-icon" aria-hidden="true" /></button>
        <button className="mobile-theme-action" type="button" onClick={onToggleTheme} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}><span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span><small>{theme === "dark" ? "Light" : "Dark"}</small></button>
        <button className={`mobile-profile-action ${activeModule === "profile" ? "active" : ""}`} type="button" onClick={onOpenProfile} aria-label="Profile"><span aria-hidden="true"><Image className="nav-svg-icon" src="/icons/icon_profile.svg" alt="" width={24} height={24} /></span><small>Profile</small></button>
      </nav>
    </>
  );
}

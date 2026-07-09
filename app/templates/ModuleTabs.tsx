import Image from "next/image";
import { LocaleSelect, MobileLocaleAction, useI18n } from "../lib/i18n";
import { moduleTabs, type ModuleTab } from "./app-shell";

export type ActiveView = ModuleTab | "profile" | "admin";

type ModuleTabsProps = {
  activeModule: ActiveView;
  onSelectModule: (module: ActiveView) => void;
  onOpenProfile: () => void;
  theme: "light" | "dark" | "auto";
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
  users: "/icons/icon_user-list.svg",
  compliance: "/icons/icon_compliance.svg",
};

type NavigationItemsProps = {
  activeModule: ActiveView;
  isAdmin: boolean;
  onSelectModule: (module: ActiveView) => void;
};

function NavigationItems({ activeModule, isAdmin, onSelectModule }: NavigationItemsProps) {
  const { t } = useI18n();
  return (
    <>
      {moduleTabs.map((tab) => (
        <button type="button" key={tab.id} className={activeModule === tab.id ? "active" : ""} onClick={() => onSelectModule(tab.id)} aria-label={t(tab.labelKey)}>
          <span className="tab-icon" aria-hidden="true"><Image className="nav-svg-icon" src={icons[tab.id]} alt="" width={24} height={24} /></span>
          <span className="nav-label">{t(tab.labelKey)}</span>
        </button>
      ))}
      {isAdmin && <button type="button" className={activeModule === "admin" ? "active" : ""} onClick={() => onSelectModule("admin")} aria-label={t("nav.userManagement")}><span className="tab-icon" aria-hidden="true"><Image className="nav-svg-icon" src="/icons/icon_admin.svg" alt="" width={24} height={24} /></span><span className="nav-label">{t("nav.admin")}</span></button>}
    </>
  );
}

export function ModuleTabs({ activeModule, onSelectModule, onOpenProfile, theme, onToggleTheme, userEmail, userName, userGroups = [], isNavSlim, onToggleNavSlim, onLogout, isLoggingOut }: ModuleTabsProps) {
  const { t } = useI18n();
  const isAdmin = userGroups.includes("admin");
  return (
    <>
      <aside className="app-sidebar side-navigation" aria-label={t("nav.primary")}>
        <button className="nav-edge-toggle" type="button" onClick={onToggleNavSlim} aria-label={isNavSlim ? t("nav.expandSidebar") : t("nav.collapseSidebar")}>
          <span className="nav-edge-toggle-icon" aria-hidden="true" />
        </button>
        <div className="brand-row"><div className="brand-mark" aria-label="ultilog"><span className="sail-logo">◢</span><strong>ultilog</strong></div></div>
        <nav className={`module-tabs ${isAdmin ? "has-admin-tab" : ""}`} aria-label={t("nav.modules")}>
          <NavigationItems activeModule={activeModule} isAdmin={isAdmin} onSelectModule={onSelectModule} />
        </nav>
        <div className="sidebar-spacer" />
        <section className="sync-icon-card" aria-label={t("nav.cloudSyncStatus")}><span className="sync-icon" aria-hidden="true" /></section>
        <LocaleSelect className="sidebar-control-row locale-select" />
        <div className="sidebar-control-row"><button className="theme-toggle" type="button" onClick={onToggleTheme}><span className="theme-icon" aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span><span>{theme === "dark" ? t("nav.light") : t("nav.dark")}</span></button></div>
        <button className={`profile-card ${activeModule === "profile" ? "active" : ""}`} type="button" onClick={onOpenProfile}><span><Image className="nav-svg-icon" src="/icons/icon_profile.svg" alt="" width={24} height={24} /></span><strong>{userName ?? t("nav.profile")}</strong><small>{userEmail ?? t("nav.noEmail")}</small></button>
        <button className="logout-chip" type="button" onClick={onLogout} disabled={isLoggingOut} aria-label={t("nav.logout")}>{isLoggingOut ? t("nav.saving") : t("nav.logout")}</button>
      </aside>
      <nav className={`mobile-bottom-nav ${isAdmin ? "has-admin-tab" : ""}`} aria-label={t("nav.primary")}>
        <NavigationItems activeModule={activeModule} isAdmin={isAdmin} onSelectModule={onSelectModule} />
        <button className="mobile-sync-action" type="button" disabled aria-label={t("nav.synced")}><span className="sync-icon" aria-hidden="true" /></button>
        <MobileLocaleAction className="mobile-locale-action" />
        <button className="mobile-theme-action" type="button" onClick={onToggleTheme} aria-label={theme === "dark" ? t("nav.switchLight") : t("nav.switchDark")}><span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span><small>{theme === "dark" ? t("nav.light") : t("nav.dark")}</small></button>
        <button className={`mobile-profile-action ${activeModule === "profile" ? "active" : ""}`} type="button" onClick={onOpenProfile} aria-label={t("nav.profile")}><span aria-hidden="true"><Image className="nav-svg-icon" src="/icons/icon_profile.svg" alt="" width={24} height={24} /></span><small>{t("nav.profile")}</small></button>
      </nav>
    </>
  );
}

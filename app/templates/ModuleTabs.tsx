import { moduleTabs, type ModuleTab } from "./app-shell";

type ModuleTabsProps = {
  activeModule: ModuleTab;
  onSelectModule: (module: ModuleTab) => void;
};

export function ModuleTabs({ activeModule, onSelectModule }: ModuleTabsProps) {
  return (
    <nav className="module-tabs" aria-label="Business logic modules">
      {moduleTabs.map((tab) => (
        <button type="button" key={tab.id} className={activeModule === tab.id ? "active" : ""} onClick={() => onSelectModule(tab.id)}>
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

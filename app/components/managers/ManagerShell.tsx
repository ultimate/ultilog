import type { ReactNode } from "react";

export type SplitDirection = "vertical" | "horizontal";

type ManagerShellProps = {
  title: string;
  split: SplitDirection;
  newLabel: string;
  onNew: () => void;
  onToggleSplit: () => void;
  list: ReactNode;
  form: ReactNode;
};

export function ManagerShell({ title, split, newLabel, onNew, onToggleSplit, list, form }: ManagerShellProps) {
  return (
    <div className={`manager-split ${split}`}>
      <article className="info-card">
        <div className="card-title-row">
          <h3>{title}</h3>
          <div className="table-actions">
            <button type="button" className="edit-chip" onClick={onNew}>{newLabel}</button>
            <button type="button" className="edit-chip" onClick={onToggleSplit}>{split === "vertical" ? "Horizontal split" : "Vertical split"}</button>
          </div>
        </div>
        {list}
      </article>
      <article className="info-card">{form}</article>
    </div>
  );
}

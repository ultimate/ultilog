import type { ReactNode } from "react";

export type SplitDirection = "vertical" | "horizontal";

type ManagerShellProps = {
  title: string;
  split?: SplitDirection;
  newLabel: string;
  onNew: () => void;
  list: ReactNode;
  form: ReactNode;
  showPictures?: boolean;
};

export function ManagerShell({ title, split = "vertical", newLabel, onNew, list, form, showPictures = false }: ManagerShellProps) {
  return (
    <div className={`manager-split ${split}`} data-pictures={showPictures ? "show" : "hide"}>
      <article className="info-card">
        <div className="card-title-row">
          <h3>{title}</h3>
          <div className="table-actions">
            <button type="button" className="edit-chip" onClick={onNew}>{newLabel}</button>
          </div>
        </div>
        {list}
      </article>
      <article className="info-card">{form}</article>
    </div>
  );
}

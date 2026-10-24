import type { ButtonHTMLAttributes, ReactNode } from "react";
export function SheetAction({ label, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode }) {
  return <span className="sheet-action-wrap"><button {...props} type="button" aria-label={label} title={label}><span aria-hidden="true">{children}</span></button><span role="tooltip" className="sheet-action-tooltip">{label}</span></span>;
}

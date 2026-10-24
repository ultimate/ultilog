import { useId, useState } from "react";
import { useI18n } from "../../lib/i18n";

export function CrewSearchSelect({ members, disabled, onSelect }: { members: { id: string; name: string }[]; disabled: boolean; onSelect: (id: string) => void }) {
  const { t } = useI18n();
  const id = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const results = members.filter(member => member.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const selectedIndex = Math.min(index, Math.max(0, results.length - 1));
  const select = (memberId: string) => { onSelect(memberId); setQuery(""); setOpen(false); setIndex(0); };
  return <div className="crew-search-select" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <input role="combobox" aria-label={t("crew.addMember")} aria-autocomplete="list" aria-expanded={open} aria-controls={id} aria-activedescendant={open && results.length ? `${id}-${selectedIndex}` : undefined}
      disabled={disabled} value={query} placeholder={t("crew.select")} onFocus={() => setOpen(true)}
      onChange={event => { setQuery(event.target.value); setIndex(0); setOpen(true); }}
      onKeyDown={event => {
        if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
        else if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setOpen(true); setIndex(Math.min(Math.max(0, selectedIndex + (event.key === "ArrowDown" ? 1 : -1)), results.length - 1)); }
        else if (event.key === "Enter" && open) { event.preventDefault(); if (results[selectedIndex]) select(results[selectedIndex].id); }
      }} />
    {open && !disabled && <ul role="listbox" id={id} aria-label={t("crew.select")}>
      {results.map((member, i) => <li role="option" aria-selected={i === selectedIndex} id={`${id}-${i}`} key={member.id} onMouseDown={event => event.preventDefault()} onClick={() => select(member.id)}>{member.name}</li>)}
      {!results.length && <li role="presentation">{t("details.noCrewResults")}</li>}
    </ul>}
  </div>;
}

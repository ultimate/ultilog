"use client";

import { useMemo, useState } from "react";
import { countryFlagGroups, flagGroups, flagOptionEmoji } from "../lib/flags";

type CommonProps = {
  id: string;
  label: string;
  emptyLabel: string;
  searchLabel: string;
  noResultsLabel: string;
  className?: string;
};

type IsoCountrySelectorProps = CommonProps & {
  mode: "iso-code";
  value: string;
  onChange: (value: string) => void;
};

type BoatFlagSelectorProps = CommonProps & {
  mode: "flag-emoji";
  value: string;
  onChange: (value: string) => void;
};

export type CountryFlagSelectorProps = IsoCountrySelectorProps | BoatFlagSelectorProps;

export function filterFlagGroups(groups: typeof flagGroups, query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return groups;
  const hasExactCodeMatch = groups.some((group) =>
    group.flags.some((flag) => flag.code.toLocaleLowerCase() === normalizedQuery),
  );

  return groups.flatMap((group) => {
    const continentMatches = group.continent.toLocaleLowerCase().includes(normalizedQuery);
    const flags = hasExactCodeMatch
      ? group.flags.filter((flag) => flag.code.toLocaleLowerCase() === normalizedQuery)
      : continentMatches
      ? group.flags
      : group.flags.filter((flag) =>
          flag.name.toLocaleLowerCase().includes(normalizedQuery)
          || flag.code.toLocaleLowerCase().includes(normalizedQuery),
        );
    return flags.length ? [{ ...group, flags }] : [];
  });
}

/** A country selector with explicit storage semantics for profiles and boats. */
export function CountryFlagSelector(props: CountryFlagSelectorProps) {
  const [query, setQuery] = useState("");
  const groups = props.mode === "iso-code" ? countryFlagGroups : flagGroups;
  const visibleGroups = useMemo(() => filterFlagGroups(groups, query), [groups, query]);
  const optionValue = (flag: (typeof flagGroups)[number]["flags"][number]) =>
    props.mode === "iso-code" ? flag.code : flagOptionEmoji(flag);
  const hasCatalogValue = groups.some((group) =>
    group.flags.some((flag) => optionValue(flag) === props.value),
  );

  return (
    <div className="flag-chooser-field">
      <label htmlFor={props.id}>{props.label}</label>
      <input
        id={`${props.id}-search`}
        className="flag-chooser-search"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={props.searchLabel}
        aria-label={props.searchLabel}
        autoComplete="off"
      />
      <select
        id={props.id}
        className={props.className ?? "flag-chooser"}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      >
        <option value="">{props.emptyLabel}</option>
        {props.mode === "flag-emoji" && props.value && !hasCatalogValue ? (
          <option value={props.value}>{props.value}</option>
        ) : null}
        {query && visibleGroups.length === 0 ? (
          <option value="" disabled>{props.noResultsLabel}</option>
        ) : null}
        {visibleGroups.map((group) => (
          <optgroup key={group.continent} label={group.continent}>
            {group.flags.map((flag) => {
              const emoji = flagOptionEmoji(flag);
              return (
                <option key={flag.code} value={optionValue(flag)}>
                  {emoji} {flag.name}
                </option>
              );
            })}
          </optgroup>
        ))}
      </select>
    </div>
  );
}

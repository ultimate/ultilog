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
  availableCountryCodes?: readonly string[];
  availableOnlyLabel?: string;
  availableMarkerLabel?: string;
  unavailableMarkerLabel?: string;
};

type BoatFlagSelectorProps = CommonProps & {
  mode: "flag-emoji";
  value: string;
  onChange: (value: string) => void;
};

export type CountryFlagSelectorProps = IsoCountrySelectorProps | BoatFlagSelectorProps;

export function filterFlagGroups(
  groups: typeof flagGroups,
  query: string,
  includeFlag: (flag: (typeof flagGroups)[number]["flags"][number]) => boolean = () => true,
) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const hasExactCodeMatch = groups.some((group) =>
    group.flags.some((flag) => flag.code.toLocaleLowerCase() === normalizedQuery),
  );

  return groups.flatMap((group) => {
    const continentMatches = normalizedQuery && group.continent.toLocaleLowerCase().includes(normalizedQuery);
    const flags = !normalizedQuery
      ? group.flags
      : hasExactCodeMatch
        ? group.flags.filter((flag) => flag.code.toLocaleLowerCase() === normalizedQuery)
        : continentMatches
          ? group.flags
          : group.flags.filter((flag) =>
            flag.name.toLocaleLowerCase().includes(normalizedQuery)
            || flag.code.toLocaleLowerCase().includes(normalizedQuery),
          );
    const includedFlags = flags.filter(includeFlag);
    return includedFlags.length ? [{ ...group, flags: includedFlags }] : [];
  });
}

/** A country selector with explicit storage semantics for profiles and boats. */
export function CountryFlagSelector(props: CountryFlagSelectorProps) {
  const [query, setQuery] = useState("");
  const [availableOnly, setAvailableOnly] = useState(false);
  const groups = props.mode === "iso-code" ? countryFlagGroups : flagGroups;
  const availableCountryCodes = props.mode === "iso-code" ? props.availableCountryCodes : undefined;
  const availableCodes = useMemo(() => new Set(availableCountryCodes ?? []), [availableCountryCodes]);
  const visibleGroups = useMemo(
    () => filterFlagGroups(groups, query, (flag) => !availableOnly || availableCodes.has(flag.code)),
    [availableCodes, availableOnly, groups, query],
  );
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
      {props.mode === "iso-code" && props.availableOnlyLabel && props.availableCountryCodes ? (
        <label className="flag-chooser-filter">
          <input
            type="checkbox"
            checked={availableOnly}
            onChange={(event) => {
              const checked = event.target.checked;
              setAvailableOnly(checked);
              if (checked && props.mode === "iso-code" && props.value && !availableCodes.has(props.value)) props.onChange("");
            }}
          />
          {props.availableOnlyLabel}
        </label>
      ) : null}
      {props.mode === "iso-code" && props.availableCountryCodes && props.availableMarkerLabel && props.unavailableMarkerLabel ? (
        <small className="flag-chooser-legend">✓ {props.availableMarkerLabel} · ○ {props.unavailableMarkerLabel}</small>
      ) : null}
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
        {visibleGroups.length === 0 ? <option disabled>{props.noResultsLabel}</option> : null}
        {visibleGroups.map((group) => (
          <optgroup key={group.continent} label={group.continent}>
            {group.flags.map((flag) => {
              const emoji = flagOptionEmoji(flag);
              return (
                <option key={flag.code} value={optionValue(flag)}>
                  {availableCountryCodes ? `${availableCodes.has(flag.code) ? "✓" : "○"} ` : ""}{emoji} {flag.name}
                </option>
              );
            })}
          </optgroup>
        ))}
      </select>
    </div>
  );
}

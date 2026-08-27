import { useMemo, useState } from "react";
import { countryFlagGroups, flagGroups, flagOptionEmoji } from "../lib/flags";

type CommonProps = {
  id: string;
  label: string;
  emptyLabel: string;
  /** Labels used by searchable selector implementations. */
  searchLabel?: string;
  noResultsLabel?: string;
  availableCountryCodes?: readonly string[];
  availableOnlyLabel?: string;
  availableMarkerLabel?: string;
  unavailableMarkerLabel?: string;
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

/** A country selector with explicit storage semantics for profiles and boats. */
export function CountryFlagSelector(props: CountryFlagSelectorProps) {
  const [query, setQuery] = useState("");
  const [availableOnly, setAvailableOnly] = useState(false);
  const groups = props.mode === "iso-code" ? countryFlagGroups : flagGroups;
  const availableCodes = useMemo(() => new Set(props.availableCountryCodes ?? []), [props.availableCountryCodes]);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleGroups = groups.map((group) => ({
    ...group,
    flags: group.flags.filter((flag) => {
      const matchesSearch = !normalizedQuery || flag.code.toLocaleLowerCase().includes(normalizedQuery) || flag.name.toLocaleLowerCase().includes(normalizedQuery);
      return matchesSearch && (!availableOnly || availableCodes.has(flag.code));
    }),
  })).filter((group) => group.flags.length > 0);
  const optionValue = (flag: (typeof flagGroups)[number]["flags"][number]) =>
    props.mode === "iso-code" ? flag.code : flagOptionEmoji(flag);
  const hasCatalogValue = groups.some((group) =>
    group.flags.some((flag) => optionValue(flag) === props.value),
  );

  return (
    <div className="flag-chooser-field">
      <label htmlFor={props.id}>{props.label}</label>
      {props.searchLabel ? (
        <input
          className="flag-chooser-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={props.searchLabel}
          aria-label={props.searchLabel}
        />
      ) : null}
      {props.availableOnlyLabel && props.availableCountryCodes ? (
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
      {props.availableCountryCodes && props.availableMarkerLabel && props.unavailableMarkerLabel ? (
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
        {visibleGroups.length === 0 && props.noResultsLabel ? <option disabled>{props.noResultsLabel}</option> : null}
        {visibleGroups.map((group) => (
          <optgroup key={group.continent} label={group.continent}>
            {group.flags.map((flag) => {
              const emoji = flagOptionEmoji(flag);
              return (
                <option key={flag.code} value={optionValue(flag)}>
                  {props.availableCountryCodes ? `${availableCodes.has(flag.code) ? "✓" : "○"} ` : ""}{emoji} {flag.name}
                </option>
              );
            })}
          </optgroup>
        ))}
      </select>
    </div>
  );
}

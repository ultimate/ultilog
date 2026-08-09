import { countryFlagGroups, flagGroups, flagOptionEmoji } from "../lib/flags";

type CommonProps = {
  id: string;
  label: string;
  emptyLabel: string;
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
  const groups = props.mode === "iso-code" ? countryFlagGroups : flagGroups;
  const optionValue = (flag: (typeof flagGroups)[number]["flags"][number]) =>
    props.mode === "iso-code" ? flag.code : flagOptionEmoji(flag);
  const hasCatalogValue = groups.some((group) =>
    group.flags.some((flag) => optionValue(flag) === props.value),
  );

  return (
    <div className="flag-chooser-field">
      <label htmlFor={props.id}>{props.label}</label>
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
        {groups.map((group) => (
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

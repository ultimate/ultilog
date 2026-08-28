import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CountryFlagSelector, filterFlagGroups } from "../../app/components/CountryFlagSelector";
import { countryFlagGroups } from "../../app/lib/flags";

describe("CountryFlagSelector", () => {
  it("uses ISO alpha-2 values and includes an accessible empty profile option", () => {
    const markup = renderToStaticMarkup(<CountryFlagSelector id="country" label="Country code" emptyLabel="Not selected" searchLabel="Search countries" noResultsLabel="No countries found" value="CH" onChange={() => undefined} />);

    expect(markup).toContain('<label for="country">Country code</label>');
    expect(markup).toContain('type="search"');
    expect(markup).toContain('aria-label="Search countries"');
    expect(markup).toContain('<option value="">Not selected</option>');
    expect(markup).toContain('<option value="CH" selected="">🇨🇭 Switzerland</option>');
    expect(markup).not.toContain('value="🇨🇭"');
    expect(markup).not.toContain("Pirate");
  });

  it("filters country names and codes while preserving continent groups", () => {
    const byName = filterFlagGroups(countryFlagGroups, "switz");
    expect(byName).toEqual([{ continent: "Europe", flags: [{ code: "CH", name: "Switzerland" }] }]);

    const byCode = filterFlagGroups(countryFlagGroups, " nz ");
    expect(byCode).toEqual([{ continent: "Oceania", flags: [{ code: "NZ", name: "New Zealand" }] }]);

    const byContinent = filterFlagGroups(countryFlagGroups, "Africa");
    expect(byContinent).toHaveLength(1);
    expect(byContinent[0].continent).toBe("Africa");
    expect(byContinent[0].flags.length).toBeGreaterThan(1);
  });

  it("uses ISO codes while displaying the country flag", () => {
    const markup = renderToStaticMarkup(<CountryFlagSelector id="flag" label="Flag state" emptyLabel="Choose a flag" searchLabel="Search countries" noResultsLabel="No countries found" value="CH" onChange={() => undefined} />);

    expect(markup).toContain('<option value="CH" selected="">🇨🇭 Switzerland</option>');
    expect(markup).not.toContain('value="🇨🇭"');
  });

  it("combines the shared search behavior with an availability filter", () => {
    const availableCodes = new Set(["CH", "DE"]);
    const availableInEurope = filterFlagGroups(
      countryFlagGroups,
      "",
      (flag) => availableCodes.has(flag.code),
    );

    expect(availableInEurope).toEqual([{
      continent: "Europe",
      flags: [
        { code: "DE", name: "Germany" },
        { code: "CH", name: "Switzerland" },
      ],
    }]);
  });
});

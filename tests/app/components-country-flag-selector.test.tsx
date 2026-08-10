import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CountryFlagSelector } from "../../app/components/CountryFlagSelector";

describe("CountryFlagSelector", () => {
  it("uses ISO alpha-2 values and includes an accessible empty profile option", () => {
    const markup = renderToStaticMarkup(<CountryFlagSelector id="country" mode="iso-code" label="Country code" emptyLabel="Not selected" value="CH" onChange={() => undefined} />);

    expect(markup).toContain('<label for="country">Country code</label>');
    expect(markup).toContain('<option value="">Not selected</option>');
    expect(markup).toContain('<option value="CH" selected="">🇨🇭 Switzerland</option>');
    expect(markup).not.toContain('value="🇨🇭"');
    expect(markup).not.toContain("Pirate");
  });
});

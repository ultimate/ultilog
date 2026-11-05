import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LinkedLogText } from "../../../app/components/logbook/LogTextPopover";
import { OPEN_METEO_CREDIT } from "../../../app/domain/meteo/attribution";

describe("log text links", () => {
  it("links the attribution labels instead of repeating bracketed URLs", () => {
    const html = renderToStaticMarkup(<LinkedLogText text={OPEN_METEO_CREDIT} />);
    expect(html).toContain('href="https://open-meteo.com/"');
    expect(html).toContain('>Weather data by Open-Meteo.com</a>');
    expect(html).toContain('href="https://creativecommons.org/licenses/by/4.0/"');
    expect(html).toContain('>CC BY 4.0</a>');
    expect(html).not.toContain('(https://');
  });
  it("keeps ordinary URL punctuation outside the link", () => {
    const html = renderToStaticMarkup(<LinkedLogText text="Source: https://example.com/data." />);
    expect(html).toContain('href="https://example.com/data"');
    expect(html).toContain('>https://example.com/data</a>.');
  });
  it("escapes user content without making executable schemes clickable", () => {
    const html = renderToStaticMarkup(<LinkedLogText text={'<script>alert(1)</script> javascript:alert(1)'} />);
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<a ');
  });
});

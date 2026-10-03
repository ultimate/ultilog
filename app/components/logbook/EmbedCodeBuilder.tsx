"use client";

import { useState } from "react";
import { embedThemeDefaults, type EmbedTheme } from "../../domain/logbook/embed-theme";

const fields: { key: keyof EmbedTheme; label: string; parameter: string }[] = [
  { key: "background", label: "Page background", parameter: "bg" },
  { key: "surface", label: "Cards", parameter: "surface" },
  { key: "text", label: "Text", parameter: "text" },
  { key: "accent", label: "Accent", parameter: "accent" },
];

export function EmbedCodeBuilder({ shareUrl, enabled }: { shareUrl: string; enabled: boolean }) {
  const [theme, setTheme] = useState<EmbedTheme>({ ...embedThemeDefaults });
  const [copied, setCopied] = useState(false);
  const query = new URLSearchParams({ embed: "1" });
  fields.forEach(({ key, parameter }) => query.set(parameter, theme[key]));
  const embedUrl = `${shareUrl}?${query.toString()}`;
  const code = `<iframe src="${embedUrl}" title="Shared Ultilog logbook" width="100%" height="800" style="border:0;border-radius:16px" loading="lazy"></iframe>`;

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="embed-builder" aria-labelledby="embed-builder-title">
      <div>
        <h3 id="embed-builder-title">Embed on your website</h3>
        <p>Choose four colors, then paste this iframe into your website. You can also edit the URL parameters later.</p>
      </div>
      <div className="embed-color-grid">
        {fields.map(({ key, label }) => (
          <label key={key}><span>{label}</span><input type="color" value={theme[key]} onChange={event => {
            // React clears currentTarget after the handler returns. Capture the
            // color before the state updater runs so concurrent rendering does
            // not attempt to read from a cleared event.
            const color = event.currentTarget.value;
            setTheme(current => ({ ...current, [key]: color }));
          }} /></label>
        ))}
      </div>
      <label className="embed-code-label" htmlFor="embed-code">Embed code</label>
      <textarea id="embed-code" value={enabled ? code : "Enable sharing above to create embed code."} readOnly rows={5} />
      <div className="embed-actions">
        <button type="button" disabled={!enabled} onClick={copy}>{copied ? "Copied!" : "Copy embed code"}</button>
        {enabled ? <a href={embedUrl} target="_blank" rel="noreferrer">Preview embed</a> : null}
      </div>
    </section>
  );
}

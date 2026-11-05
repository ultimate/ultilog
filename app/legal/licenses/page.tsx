import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Third-party licenses · Ultilog" };

export default function LicensesPage() {
  return <main className="legal-page"><article className="legal-page-card">
    <h1>Third-party licenses and data credits</h1>
    <p>Ultilog uses third-party software and data under their respective licenses.
      The project’s MIT license does not replace these terms.</p>
    <h2>Software and fonts</h2>
    <p><a href="/legal/third-party-notices.txt">Full third-party copyright notices and license texts</a></p>
    <p>The application’s typography uses fonts installed on your device.</p>
    <p>The notice file covers browser libraries and bundled framework components.
      Server-side dependencies are discussed in the{' '}
      <a href="https://github.com/ultimate/ultilog/blob/main/docs/licensing.md">licensing review</a>.</p>
    <h2>Weather data</h2>
    <p>Where used, <a href="https://open-meteo.com/">weather data by Open-Meteo.com</a> is
      licensed under <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>.
      Values are converted, rounded or adapted for this logbook. Demo weather is representative
      historical-model data, not certified observations. Use of the hosted API is separately
      subject to <a href="https://open-meteo.com/en/terms">Open-Meteo’s service terms</a>.</p>
    <p>NOAA/NWS data is generally public domain unless otherwise noted.
      <a href="https://www.weather.gov/disclaimer"> NOAA/NWS terms</a> apply; no endorsement is implied.</p>
    <h2>Maps and reference data</h2>
    <p>Map data © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>,
      under the Open Database License (ODbL). Seamark tiles ©{' '}
      <a href="https://www.openseamap.org">OpenSeaMap contributors</a>, under{' '}
      <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC BY-SA 2.0</a>.
      These data and tile licenses do not relicense unrelated Ultilog code or your original logbook entries.</p>
    <p>Natural Earth coastline reference data used for the demo route audit is{' '}
      <a href="https://www.naturalearthdata.com/about/terms-of-use/">public domain</a>.</p>
    <p><Link href="/legal">Back to legal information</Link></p>
  </article></main>;
}

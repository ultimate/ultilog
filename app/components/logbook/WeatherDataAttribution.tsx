export function WeatherDataAttribution() {
  return <small className="weather-data-attribution">
    Open-Meteo data, where used: <a href="https://open-meteo.com/">Weather data by Open-Meteo.com</a>{" · "}
    <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>.
    {" "}Values converted, rounded or adapted for this logbook.
    <span className="print-only"> https://open-meteo.com/ · https://creativecommons.org/licenses/by/4.0/</span>
  </small>;
}

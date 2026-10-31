# Logbook scanner image fixtures

The generated UltiLog fixtures are ordinary PNG files so they remain directly
inspectable and usable by the live scanner tests.

The following files are tracked at the paths recorded by each fixture's
`template.images` property:

- `ultilog-en-full/scanned.png`
- `ultilog-de-full/scanned.png`
- `ultilog-de-full/rotated-shadow.png`
- `ultilog-fr-compact/scanned.png`
- `ultilog-it-compact/scanned.png`

Their filenames and image signatures are checked by the fixture suite. Live
extraction cases are enabled when `RUN_LIVE_SCANNER_TESTS=true` and an
`OPENAI_API_KEY` is configured.

## Real-world corrected exports

`real-world/` contains six Respocean photos from July 12–17, 2026, paired by
filename with the corrected production `log_sheet` and `log_lines` JSON exports.
`real-world-fixture.ts` validates sheet references and consecutive `sort_order`,
then projects only recognition fields into one independent case per photograph.
The original exports are retained unchanged. Tests never contact production.

Each photo also has a `source_overrides.json`: `allRows` applies to every row,
then `rows` applies one override object per exported row in source order.
These annotations distinguish source transcription from later application edits:

- All photos lack temperature and tide columns. Their filled-in temperatures and
  default tide zeros must not become OCR readings. Blank course corrections,
  absent moon/weather-note cells, and absent per-row engine hours
  likewise remain empty. Application unit defaults are tested separately.
- Pressure is written only on selected rows. The annotations remove values
  carried forward into blank cells. Empty sail/motor-distance cells and speed
  cells stay empty even when the exports contain default zeros. Written zero
  courses, sea heights, and distances remain zero.
- July 13 excludes the crossed-out table row and includes the timed 18:28 footer
  entry. Its first three true-course readings are taken from the printed `rwK`
  column rather than the shifted exported course values. The footer has no
  weather or pressure observation.
- July 16 has visible 0.5 sea heights on rows 2–4, despite exported zeros. Wind
  cells on rows 3–4 are empty. July 17 also has empty sea/wind cells annotated.
- July 15–17 log counters differ from the daily distances edited into the app.
  Overrides retain the visible counter readings, including July 17's `.21` and
  `.22` shorthand as decimals, rather than deriving daily distances.

The exported titles, route master data, and remarks include application edits;
real-world live tests compare the source-reviewed row fields rather than exact
master-data strings or edited prose. Row times are compared as local HH:mm,
without inventing an unprinted timezone. Corrected coordinates and weather
remain the reference; numeric comparisons allow the existing fixture tolerance.
Empty expectations are asserted explicitly, including absent columns. Live
recognition checks row counts and all listed fields using the configured model.

Run the live fixtures with `RUN_LIVE_SCANNER_TESTS=true OPENAI_API_KEY=...` and
`npx vitest run tests/app/lib/logbook-scanner-fixtures.test.ts`. The default model
is `gpt-6-luna`; `LOGBOOK_SCANNER_MODEL` can override it. Offline fixture and
normalization tests need no API key.

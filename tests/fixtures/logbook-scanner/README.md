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

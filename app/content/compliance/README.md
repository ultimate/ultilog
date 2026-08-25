# Compliance catalog contract

`catalog.json` is the content-authoring contract. Its current top-level content is
`legalLogbookRequirements` (flag-state legal documents) and `licenses` (licence
requirements). `_instructions` is author guidance, not application data.

## Legal documents and localized content

Each legal document requires `countryCode`, `defaultLanguage`, and `translations`.
Each translation key is a language code and its value requires `title`, `authority`,
`sourceUrl`, `checkedAt`, `effectiveFrom`, and `sections`. A section requires the
stable `id`, `heading`, and HTML `citation`. `effectiveFrom` may be an empty string
when the source gives no date. No other legal-document metadata is assumed.

Localized versions of one document must contain the same section IDs in the same
order. A section ID is unique within its document; matching IDs across languages
identify translations of the same section. A legal document is uniquely identified
by `countryCode`, since the catalog currently contains one document per country.

## Licences and requirements

Each licence requires a globally unique, stable `id`, plus `countryCode`, `variant`,
`defaultLanguage`, `content`, and `requirements`. Each localized `content` value has
the same required fields as legal content, plus `licenseName`. Section IDs follow the
same translated/scoped identity rule described above.

Each requirement requires a globally unique, stable `id`, `type` (the progress
type), numeric `threshold`, nullable `filters`, and `translationKey`. Automatically
tracked requirements additionally require `unit`; supported units are `days` and
`nautical-miles`. `filters` is optional counting context represented as `null` when
there is none; its current optional fields are `propulsion` and `withinYears`.
`unit` is omitted for manual checklist requirements because it has no metric.

Tracked `type` values directly select a counter: `days-sailing`, `days-underway`,
`days-at-sea`, `sail-miles`, `motor-miles`, or `total-miles`. This discriminator is
the only added metadata needed to distinguish counting rules; filters only narrow
which records contribute. IDs must never be edited or reused after publication,
because saved progress refers to them.

## Current localization

The Swiss legal document is authored in German, French, Italian, and English. Swiss
licences are authored in German, French, and Italian. The German legal document and
licences currently contain German only. Applications must fall back to each entry's
`defaultLanguage` rather than requiring every UI language to exist in the catalog.


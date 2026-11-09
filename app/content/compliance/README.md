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
there is none; its current optional fields are `boatType`, `propulsion`, `dateWindow`, and legacy `withinYears`.
Quantitative manual requirements also supply `unit` so their targets are visible
for distances or days that cannot be verified from logged data. Boolean checklist requirements
omit `unit`; their threshold of one represents confirmation, not a distance.
The tracking view displays numeric targets and all configured counting filters.

Tracked `type` values select a counter: `days-sailing`, `days-underway`,
`days-at-sea`, or `miles`. Filters narrow which records contribute. IDs must never
be edited or reused after publication, because saved progress refers to them.

Boat type and propulsion are separate types, each currently accepting lowercase
`sail` and `motor` values. They can evolve independently. Filters combine:
`boatType` selects eligible vessels; for `miles`, `propulsion` selects sail or
motor distance. With no propulsion filter, all distance on eligible vessels
counts. For example, `{ "boatType": "sail", "propulsion": "motor" }` counts only
motoring distance aboard sailing boats. Boat-filtered requirements exclude sheets
whose boat cannot be resolved, and include archived boats.

Swiss requirements use boat-type filters, including day, manual, and extension
requirements, without restricting propulsion. Propulsion-qualified day counters
are not automatically verifiable. Manual requirements remain user-confirmed.

## Reference dates and date windows

Licenses can set `referenceDateKind` to `theory-exam` or `extension-application`.
This changes the date label, not the existing saved `startDate` API/storage field.

A requirement can configure inclusive boundaries relative to that reference date:

```json
"dateWindow": {
  "from": { "yearOffset": -4, "boundary": "year-start" },
  "through": { "yearOffset": 4, "boundary": "year-end" }
}
```

Each boundary requires an integer `yearOffset` and `boundary`: `date` keeps the
shifted date, `year-start` selects January 1, and `year-end` selects December 31.
Exact February 29 anniversaries clamp to February 28 in non-leap years. Both
boundaries are required and must be in chronological order.

For an exam on 2021-07-01, Swiss initial-license experience counts from 2017-01-01
through 2025-12-31. The automatic 700/400-mile counters instead start at the exact exam
date (`0/date`) and end at `4/year-end`. They use `type: "miles"`, count all
propulsion mileage on the matching boat type, and ignore former manual checkmarks. Swiss extensions count from
`-4/year-start` through `0/date`, relative to the extension application date.

A date window may set `referenceDateFallback: "today"` to use today when no
reference date is saved. All Swiss licenses use this setting. Initial licenses
keep their ±4 calendar-year window around today; after-theory mileage starts today.
Add-ons run from January 1 four years before today through today. Explicit dates
override this fallback, and clearing a date restores it without persisting today.
An automatic requirement without a reference date or fallback is shown as
requiring that date. Manual confirmations remain unchanged. The UI shows
relative boundary descriptions and the resolved
period using the user's date-format preference. Sheets must fall entirely inside
the period. Only valid calendar dates participate in the date comparison; time-only
log entries do not invalidate a voyage with dated route boundaries. Fully undated
sheets are excluded when a date filter is active.

Non-Swiss `withinYears` rules retain their existing behavior: from a selected
start date through its anniversary, or a rolling lookback from today when no
date is selected. A requirement cannot combine `withinYears` and `dateWindow`.
Without either filter, a selected date remains a lower bound.

The four Swiss checklists include a unitless manual confirmation that the logbook
is handwritten for voyages counted toward the license or its extension. This
follows [Annex 3, paragraph 5 of the Hochseeausweis-Verordnung](https://www.fedlex.admin.ch/eli/cc/2007/130/de#annex_3/lvl_u1),
which expressly covers voyages credited under Articles 7 and 8. It is separate
from the general Swiss-flag logbook provisions on daily entries and signatures.

## Current localization

The Swiss legal document is authored in German, French, Italian, and English. Swiss
licences are authored in German, French, and Italian. The German legal document and
licences currently contain German only. Applications must fall back to each entry's
`defaultLanguage` rather than requiring every UI language to exist in the catalog.

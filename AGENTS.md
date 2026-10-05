# Repository instructions

## Changelog

Codex and contributors must add exactly one entry to
`app/content/changelog.json` for each branch or pull request that contains one
or more user-visible features, improvements, fixes, or security changes. The
entry must summarize the overall user-visible outcome of the branch or pull
request; do not add separate entries for its individual commits or
implementation steps. Branches and pull requests containing only tests,
refactors, dependency updates, or internal-only changes normally do not require
an entry.

Adding an entry is the opt-in mechanism for the public changelog. This project
does not use a `changelog:*` label, and a pull request title is independent of
its public changelog title.

Each entry must follow these rules:

- Choose a unique, descriptive, immutable kebab-case `id`. Keep entries ordered
  by ID.
- Treat `title.en` as authoritative historical source text.
- Add non-empty `title.de`, `title.fr`, and `title.it` translations either in the
  initial change or later.
- Never silently rewrite a historical ID or English title. If a correction is
  necessary, make the historical change explicit in the pull request.

Use this complete shape (the translated titles are optional):

```json
[
  {
    "id": "show-tidal-current-on-route-map",
    "category": "feature",
    "title": {
      "en": "Show tidal current on the route map",
      "de": "Gezeitenstrom auf der Routenkarte anzeigen",
      "fr": "Afficher le courant de marée sur la carte de route",
      "it": "Mostra la corrente di marea sulla mappa della rotta"
    }
  }
]
```

The only supported categories are `feature`, `improvement`, `fix`, and
`security`. Do not add release versions, timestamps, pull request numbers, pull
request URLs, or any other fields.

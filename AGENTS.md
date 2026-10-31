# Repository instructions

## Branches

At the start of every new conversation, fetch `origin/main` and create the task
branch from that latest remote main, unless the user explicitly asks to continue
work on an existing branch or use a different base. Do not branch from the
workspace's current checkout merely because it is already checked out. Preserve
any existing uncommitted changes; use a separate worktree if necessary.

Unless stated otherwise or asked to work on an existing branch, agents must 
name newly created branches with a prefix identifying the agent and a "/" (e.g.
"codex/..." for Codex).

## Validation

Before creating or updating a PR with application or E2E test changes, run
`npm run test:e2e:ci` in addition to the relevant unit tests, typecheck, and lint.
Run a targeted E2E test while fixing a failure, then run the full E2E suite.
Documentation-only changes do not require E2E tests.

Check browser availability early. Prefer Playwright's matching Chromium installed
with `npx playwright install --with-deps chromium` during environment setup. If
downloads are unavailable and a system Chromium is installed, set
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium` for the test command.
The environment must allow the local test server and browser to run. When a
sandbox blocks these, use the supported permission mechanism and retry.

If E2E execution remains blocked, report the exact blocker and command in the PR
and final response; do not describe unexecuted tests as passing. CI E2E checks
must pass before merging. Agent instruction changes are not public changelog
entries.

## Pull requests

Agents must include issue links in the pull request description whenever the
work corresponds to one or more GitHub issues. Use a supported closing keyword
for each issue on its own line, for example:

```text
Fixes #123
Resolves #456
```

Use `Fixes` for bugs and `Resolves` or `Closes` where appropriate. GitHub also
supports `fix`, `fixed`, `resolve`, `resolved`, `close`, and `closed`. Put these
lines in the PR description; comments alone do not establish the same link.
For issues in another repository, use `Resolves owner/repository#123`.

If the agent does not know the issue number, it must ask the user before
creating the PR. If the user confirms that there is no matching issue, the PR
may proceed without an issue link. Do not invent an issue number. Closing
keywords are interpreted only when the PR targets the default branch.

Agents must also add a label identifying the agent to every PR they create
(for example, `codex` for Codex) and assign the PR to the GitHub user who started
the conversation. Use the user's known GitHub identity from the conversation
or authenticated account; if that identity is unclear, ask the user for their
GitHub username. Preserve any existing labels and assignees when updating a PR.

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

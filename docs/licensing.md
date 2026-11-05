# Licensing review

Issue: https://github.com/ultimate/ultilog/issues/472

This is a technical review for the current hosted application, not a legal
opinion or a guarantee against future claims. The 2026-11-05 review examined the
lockfile, fonts, bundled assets, and external data providers. No mandatory library
royalty was identified in the reviewed declarations. License conditions and
provider-service terms still apply.

## Review when dependencies change

There is no automated license scan, policy allowlist, or license gate in builds
or CI. Follow the dependency-review guidance in `AGENTS.md`: highlight changes to
`package.json` and `package-lock.json` in the PR description, including affected
packages/versions and relevant transitive changes. Distinguish server, browser,
and development use so the reviewer can request a focused license review.

Update the manually maintained browser notice file at
`public/legal/third-party-notices.txt` when dependencies delivered to users change.
It includes component-specific copyright notices and shared local license texts;
external links alone do not replace license text where inclusion is required.
Preserve custom terms instead of assuming an SPDX identifier makes notices equal.
The file is served at `/legal/third-party-notices.txt`, linked from `/legal/licenses`,
and requires no generator, Python runtime, or build hook.

## Hosting versus distributing software

Server-only use and delivery of software to a browser are different:

- Running a library on the server does not, by itself, give visitors a copy of that
  library. Ordinary GPL/LGPL distribution/source obligations are generally not
  triggered merely by interacting with a hosted service. MPL also distinguishes
  server functionality from delivery of copies outside the organization.
- JavaScript, CSS, fonts, images, or WASM sent to a browser are copies delivered to
  users, even when there is no installer or downloadable application binary.
  React, Leaflet, Next.js client code, Auth.js client code, and bundled helpers
  therefore still need their applicable copyright/license notices preserved.
- MIT/BSD notice requirements do not generally require publishing unrelated
  application source code. MPL has file-level source obligations if covered code
  is delivered; it does not automatically relicense all application code.
- AGPL and nonstandard licenses can impose different requirements, including
  conditions on network use. Review them before adoption; do not generalize the
  ordinary GPL/LGPL hosting distinction to every license.

Primary references:

- [Mozilla MPL FAQ, Q5 and Q17](https://www.mozilla.org/en-US/MPL/2.0/FAQ/):
  organizational use and server/client distribution; Q16 addresses minified JS.
- [GNU GPL v3, section 0](https://www.gnu.org/licenses/gpl-3.0.html):
  network interaction without transfer of a copy is not conveying.
- [FSF explanation of web use](https://www.fsf.org/blogs/licensing/two-new-entries-for-the-gnu-licenses-faq-1).
- [MIT license](https://opensource.org/license/mit): preserve its copyright and
  permission notice in copies or substantial portions.

Sharp/libvips currently runs on the server; its native libraries and WASM are not
served as public browser assets. Its LGPL components do not by themselves require
publishing Ultilog's application source to website visitors. Preserve upstream
notices with installed/deployed packages. If deployment conveys covered software
to an independent recipient, or a future release supplies containers, installers,
native libraries, or WASM, assess those recipients and the applicable source and
relinking duties then. This PR does not prepare a standalone binary distribution.

React Leaflet and `@react-leaflet/core` used Hippocratic-2.1. They have been removed
in favor of direct BSD-licensed Leaflet use. Do not reintroduce their nonstandard
usage, arbitration, and indemnity conditions without review.

The application's typography requests device/system fonts. Next's server and
development tools also contain fonts, which does not mean those font files are
part of the deployed application's browser UI. Review any future bundled or
remotely loaded font separately. The maintainer confirms the icons are
self-created and other symbols use font emoji; further asset-rights investigation
and external-service cost documentation are deferred as requested.

## Weather providers and attribution

Open-Meteo's [data license](https://open-meteo.com/en/licence) is CC BY 4.0.
Its [hosted-service terms](https://open-meteo.com/en/terms) separately restrict the
free API to eligible non-commercial use. Commercially reusable data does not make
commercial access to the public free API permissible. The operator confirms that
Ultilog is currently non-commercial; this is the application default and is
stated on the legal page. Review this setting before changing the site’s use.

| Configuration | Behavior |
| --- | --- |
| Unset or `OPEN_METEO_MODE=non-commercial` | Public endpoints enabled for the operator-confirmed non-commercial application |
| `OPEN_METEO_MODE=disabled` or invalid mode | Open-Meteo disabled; NOAA and local astronomy remain available |
| `OPEN_METEO_MODE=commercial` plus `OPEN_METEO_API_KEY` | Customer weather and marine endpoints; active subscription required |
| Commercial mode without a key | Disabled, without falling back to the public API |

Free-mode autofill attempts use conservative application-wide limits in the shared
database: an attempt may make two calls, and adjacent fixed windows can fall in
one rolling period. Deployments sharing a provider allowance must share the store
or impose an equivalent aggregate limit. Direct programmatic provider use must
also meet the terms.

Linked attribution and a license link appear beside private/shared weather tables
and on printed sheets. New source remarks and demo records retain textual credit
and URLs for exports. Data is described as converted, rounded or adapted; existing
entries are not rewritten. These data-attribution duties apply independently of
whether the application distributes native binaries.

[NOAA/NWS data](https://www.weather.gov/disclaimer) is generally public domain unless
otherwise noted; no endorsement is implied. The Natural Earth coastline reference
used to audit demo routes is [public domain](https://www.naturalearthdata.com/about/terms-of-use/).
Official regulatory links are references, not permission to reproduce third-party
publications or illustrations.

## Maps

OSM data is ODbL and links to its [copyright information](https://www.openstreetmap.org/copyright).
Requests use `https://tile.openstreetmap.org/{z}/{x}/{y}.png`, normal browser caching
and Referer headers, under the [tile-service policy](https://operations.osmfoundation.org/policies/tiles/).
The app does not offer bulk downloads, region prefetching, or offline tiles.

OpenSeaMap's [official FAQ](https://openseamap.org/index.php?L=27&id=faq) identifies
its database as ODbL and tiles as CC BY-SA 2.0. Visible map attribution includes the
tile-license link. No unlimited-service promise or SLA is assumed.

Printed log sheets currently contain no map tiles. Adding map screenshots, PDFs,
modified tiles, offline maps, or derived databases requires a review of the
corresponding attribution/share-alike conditions. These licenses do not relicense
unrelated original logbook entries or application code.

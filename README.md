# Ultilog

Ultilog is a responsive personal skipper logbook for tracking ICC / Swiss Hochseeausweis nautical miles across multiple boats, trips, crew lists, and log sheets.

## Authorization

`user_groups` contains permanent groups assigned by an administrator. It must
not be used to persist access derived from subscriptions, trials, promotions,
or other expiring sources. Those sources need their own provenance and validity
data and should be combined through `app/lib/authorization.ts`.

Server-side feature boundaries must call `userHasEntitlement` with the current
user ID. The groups copied into a session JWT are intended for navigation and
other presentation only: they are a snapshot from sign-in and must not be used
as authoritative permission data.

> [!NOTE]
> This web application is vibe coded with ChatGPT Codex.

## Product direction

The app is designed as a long-term personal logbook that complements the legally required boat log and handwritten mileage proof. The first version models:

- multiple boats per skipper, including registration, flag state, home port, owner, and vessel data;
- trip/day sheets bound to one boat;
- crew lists per sheet with nationality, role, and embarkation/disembarkation details;
- log lines with time, position, coordinates, log reading, course, weather, sails, engine use, and remarks;
- daily technical/resource checks, compliance checklist, and a route-map preview;
- an optional/collapsible course conversion table for later customization;
- paper-log inspired sections for daily goals, morning/evening positions, yacht master data, weather briefings, remarks, technical checks, signatures, and tour summaries;
- API-backed creation and editing of boats, trip/day sheets, crew, and log lines with PostgreSQL support for hosted deployments and automatic local SQLite storage for development.

## Legal reference

The data model follows the Swiss Hochseeausweis ordinance logbook topics from Annex 3: vessel identity, skipper identity and certificate, crew, port arrivals/departures, passage reports, watchkeeping, and important events. Digital signatures and handwritten proof requirements are intentionally out of scope for this personal supplementary log.

## Tech stack

- **Next.js** for a modern React application with simple hosting options.
- **TypeScript** for safer domain modeling.
- **Responsive CSS** for mobile, tablet, and desktop use.
- **PostgreSQL** in hosted environments, configured through `POSTGRES_URL` or `DATABASE_URL`.
- **SQLite-compatible local storage via sql.js** for local `npm run dev` usage when no PostgreSQL URL is configured.
- **Relational persistence tables** for boats, log sheets, crew members, and log lines; nested sheet metadata stays in JSON columns where it is not a standalone model.

## Getting started

Install dependencies and start the development server:

```bash
npm install
cp .env.example .env.local
npm run dev
```

For local development, leave `POSTGRES_URL` empty. The app creates `.data/ultilog.sqlite` automatically on first use. New accounts start with only their own primary crew profile so the onboarding checklist can guide them through creating their first boat and log sheet. For Vercel/PostgreSQL deployments, set `POSTGRES_URL` (or `DATABASE_URL`) from your deployment secrets.

Open [http://localhost:3000](http://localhost:3000) to view the app.


## Configuration and environment variables

Create `.env.local` from `.env.example` for development. The app uses these environment variables:

| Variable | Required | Purpose |
| --- | --- | --- |
| `POSTGRES_URL` or `DATABASE_URL` | Required for hosted/PostgreSQL deployments; leave empty for local SQLite development. | Connects the persistence layer to PostgreSQL. If neither is set, local development uses the SQLite-compatible sql.js database. |
| `LOCAL_DATABASE_PATH` | Optional. | Overrides the local sql.js database path. Defaults to `.data/ultilog.sqlite`. |
| `OPENAI_API_KEY` | Required when the scanner feature calls the OpenAI cloud provider. | Authenticates logbook photo extraction requests. The scanner endpoint returns a provider-configuration error if scans are attempted without it. |
| `LOGBOOK_SCANNER_MODEL` | Optional. | Selects the OpenAI model used by the scanner provider. Defaults to `gpt-4.1-mini`. |
| `AUTH_SECRET` / platform-provided NextAuth secret | Required for secure production authentication. | Used by NextAuth to sign/encrypt authentication state. Development may rely on framework defaults, but production should set a stable secret. |
| `DEMO_SANDBOX_TTL_HOURS` | Optional. | Sets how long an isolated demo identity remains valid. Defaults to 6 hours; the included Vercel Cron removes expired sandboxes hourly. |
| `CRON_SECRET` or `DEMO_CLEANUP_SECRET` | Required for demo cleanup. | Protects `GET`/`POST /api/demo-cleanup`. Vercel Cron sends `CRON_SECRET` automatically; other schedulers can use either variable as a Bearer token. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Required for password reset emails in production. | Configures the SMTP server used to send password reset links. `SMTP_FROM` is the sender address. `SMTP_USER` and `SMTP_PASSWORD` are optional for SMTP relays that do not require authentication. |
| `NEXT_PUBLIC_APP_URL` / `VERCEL_BRANCH_URL` / `AUTH_URL` / `NEXTAUTH_URL` | Required for deployed password reset links. | Sets the public base URL used in password reset emails. `NEXT_PUBLIC_APP_URL` takes precedence; Vercel deployments fall back to `VERCEL_BRANCH_URL`; local development falls back to `http://localhost:3000`. |

## Logbook scanner

The scanner imports photographed or handwritten paper logbook sheets and turns extracted fields into a new digital sheet. It is an assistive import flow, not an automatic source of truth.

### Scanner provider choice

The current scanner implementation uses the OpenAI Responses API as its cloud recognition provider. Configure it with `OPENAI_API_KEY`; optionally set `LOGBOOK_SCANNER_MODEL` to choose a different compatible model. If you add another provider, keep it behind the scanner provider interface and make the API route choose the provider explicitly rather than spreading provider-specific code through the app.

Tests must mock the scanner provider and must not call the real cloud LLM. Unit and route tests should replace the provider with deterministic fixtures, and end-to-end tests should intercept `/api/logbook/scanner` rather than uploading photos to the real service.

Scanner provider failures are reported with distinct API error codes where possible: `provider_authentication_failed` for invalid OpenAI API keys, `provider_quota_exceeded` for exhausted credits or quota, `provider_service_unavailable` for OpenAI service outages, and `provider_unavailable` for unclassified provider failures.

### Upload limits

Scanner uploads must be `multipart/form-data` image uploads. The endpoint accepts at most 5 images per scan request, and each image must be 10 MB or smaller. Non-image files, empty uploads, missing boat selections, and scans for boats outside the signed-in user's logbook are rejected before provider extraction.

### Privacy behavior

Photos may contain personal, crew, vessel, and voyage information. Before upload, the UI shows a privacy notice explaining that photos are sent to the configured cloud recognition provider for extraction. Raw photos are converted in memory for the provider request and are not permanently stored by Ultilog. Only the extracted draft sheet data, scanner warnings, and verification metadata are written to the logbook database.

Scanned sheets are always created with `Draft` status. Users must review and verify the extracted information and warnings before locking the sheet.

## Project structure guidelines

Keep the app organized by responsibility so feature work does not collect in a single component:

- `app/models/` contains one TypeScript data model per file plus reusable form and database row shapes. Re-export shared domain types from `app/models/logbook.ts` when a caller needs the aggregate logbook shape.
- `app/api/` contains backend API routes used by the frontend instead of calling the database directly from client components.
- `app/lib/db/` contains server-only database wrappers, SQL migrations under `app/lib/db/migrations/`, and migration helpers; `app/lib/repositories/` contains table repositories used by the persistence adapter.
- `app/domain/nautical/` is reserved for nautical business rules, for example course conversion, deviation/variation handling, or mileage-calculation helpers. Keep these files framework-independent and covered by unit tests when rules become non-trivial.
- `app/templates/` contains presentation templates and static UI copy that would otherwise make stateful TypeScript components hard to scan. Prefer moving large JSX sections or table/header definitions here.
- `app/components/` contains stateful application components and reusable UI components. Shared manager layout components live under `app/components/managers/` so boat, crew, and future managers can reuse the same shell.
- Keep `app/components/LogbookApp.tsx` focused on orchestration: API synchronization, form state, event handlers, and passing props into templates/components. When a JSX block grows independently useful, extract it before adding more behavior.

## Useful scripts

- `npm run dev` - start the local development server.
- `npm run build` - create a production build.
- `npm run start` - run the production server after building.
- `npm run lint` - run ESLint.
- `npm run typecheck` - validate TypeScript types.

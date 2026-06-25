# Ultilog

Ultilog is a responsive personal skipper logbook for tracking ICC / Swiss Hochseeausweis nautical miles across multiple boats, trips, crew lists, and log sheets.

> [!NOTE]
> This web application is vibe coded with ChatGPT Codex.

## Product direction

The app is designed as a long-term personal logbook that complements the legally required boat log and handwritten mileage proof. The first version models:

- multiple boats per skipper, including registration, flag state, home port, owner, and vessel data;
- trip/day sheets bound to one boat;
- crew lists per sheet with nationality, role, and embarkation/disembarkation details;
- log lines with time, position, coordinates, log reading, course, weather, sails, engine use, and remarks;
- watch plans, daily technical/resource checks, compliance checklist, and a route-map preview;
- an optional/collapsible course conversion table for later customization;
- paper-log inspired sections for daily goals, morning/evening positions, yacht master data, weather briefings, remarks, technical checks, signatures, and tour summaries;
- localStorage-backed creation and editing of boats and trip/day sheets, plus creation of log lines until a database is added.

## Legal reference

The data model follows the Swiss Hochseeausweis ordinance logbook topics from Annex 3: vessel identity, skipper identity and certificate, crew, port arrivals/departures, passage reports, watchkeeping, and important events. Digital signatures and handwritten proof requirements are intentionally out of scope for this personal supplementary log.

## Tech stack

- **Next.js** for a modern React application with simple hosting options.
- **TypeScript** for safer domain modeling.
- **Responsive CSS** for mobile, tablet, and desktop use.

## Getting started

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.


## Project structure guidelines

Keep the app organized by responsibility so feature work does not collect in a single component:

- `app/models/` contains one TypeScript data model per file. Re-export shared domain types from `app/models/logbook.ts` when a caller needs the aggregate logbook shape.
- `app/sample-data/` contains seed data only. Treat this folder as temporary database-initialization input; application logic should import it through a clearly named seed/default layer rather than mixing sample records into components.
- `app/domain/nautical/` is reserved for nautical business rules, for example course conversion, deviation/variation handling, or mileage-calculation helpers. Keep these files framework-independent and covered by unit tests when rules become non-trivial.
- `app/templates/` contains presentation templates and static UI copy that would otherwise make stateful TypeScript components hard to scan. Prefer moving large JSX sections or table/header definitions here.
- `app/components/` contains stateful application components and reusable UI components. Shared manager layout components live under `app/components/managers/` so boat, crew, and future managers can reuse the same shell.
- Keep `app/components/LogbookApp.tsx` focused on orchestration: browser storage, form state, event handlers, and passing props into templates/components. When a JSX block grows independently useful, extract it before adding more behavior.

## Useful scripts

- `npm run dev` - start the local development server.
- `npm run build` - create a production build.
- `npm run start` - run the production server after building.
- `npm run lint` - run ESLint.
- `npm run typecheck` - validate TypeScript types.

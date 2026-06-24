# Ultilog

Ultilog is a responsive personal skipper logbook for tracking ICC / Swiss Hochseeausweis nautical miles across multiple boats, trips, crew lists, and log sheets.

## Product direction

The app is designed as a long-term personal logbook that complements the legally required boat log and handwritten mileage proof. The first version models:

- multiple boats per skipper, including registration, flag state, home port, owner, and vessel data;
- trip/day sheets bound to one boat;
- crew lists per sheet with nationality, role, and embarkation/disembarkation details;
- log lines with time, position, coordinates, log reading, course, weather, sails, engine use, and remarks;
- watch plans, daily technical/resource checks, compliance checklist, and a route-map preview;
- an optional/collapsible course conversion table for later customization.

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

## Useful scripts

- `npm run dev` - start the local development server.
- `npm run build` - create a production build.
- `npm run start` - run the production server after building.
- `npm run lint` - run ESLint.
- `npm run typecheck` - validate TypeScript types.

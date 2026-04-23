# Neotoma

A standalone React SPA for inspecting and managing all data stored in a Neotoma database instance. Provides full-coverage UI for every Neotoma REST API endpoint: browsing entities, observations, sources, relationships, schemas, timeline events, and interpretations, with an interactive graph explorer and top-level dashboard analytics.

## Quick Start

```bash
# Install dependencies
npm install

# Start inspector + matching Neotoma dev API
npm run dev

# Start inspector + matching Neotoma prod API
npm run dev -- --env prod

# Build for production
npm run build
```

## Configuration

`npm run dev` now launches a Neotoma API automatically via the CLI and injects the matching default API URL into the app:

- `npm run dev` -> `dev` environment -> `http://localhost:3080`
- `npm run dev -- --env prod` -> `prod` environment -> `http://localhost:3180`

During local development, the SPA talks to the API through the Vite proxy at `/api`, which avoids browser CORS issues while still targeting the matching Neotoma environment above.

You can still override the API URL via environment variable or the Settings page:

```bash
# .env or .env.local
VITE_NEOTOMA_ENV=dev
VITE_NEOTOMA_API_URL=http://localhost:3080
```

Saved API URLs and auth tokens are scoped per environment (`dev` / `prod`), so switching preserves separate connection settings.

## Pages

- **Dashboard** (`/`) — Top-level stats, entity type breakdown chart, recent timeline activity, health status
- **Entities** (`/entities`) — Filterable/sortable entity list with search, type filtering, pagination
- **Entity Detail** (`/entities/:id`) — Snapshot, observations, relationships, graph neighborhood, field provenance; Edit tab for multi-field batch corrections with optimistic concurrency and a live canonical-markdown preview (sourced from `GET /entities/:id/markdown`); actions: correct, merge, delete/restore. Batch corrections submit through `POST /entities/:id/batch_correct`, sharing the same `applyBatchCorrection` backend as the `neotoma edit <id>` CLI.
- **Observations** (`/observations`) — Browse and create observations with JSON field viewer
- **Sources** (`/sources`) — Browse sources, upload files, structured store; download via signed URLs
- **Relationships** (`/relationships`) — Browse, create, delete/restore relationships with snapshot provenance
- **Graph Explorer** (`/graph`) — Interactive force-directed graph visualization with React Flow
- **Schemas** (`/schemas`) — Registry browser, field/reducer detail, register/update forms, candidate analysis, recommendations
- **Timeline** (`/timeline`) — Chronological event stream with date/type filters
- **Interpretations** (`/interpretations`) — AI interpretation run history
- **Settings** (`/settings`) — API connection, server info, user details, snapshot health

## Tech Stack

- React 18 + TypeScript
- Vite 6
- Tailwind CSS + shadcn/ui (Radix)
- TanStack Query v5 + TanStack Table
- React Router v7
- Recharts (dashboard charts)
- @xyflow/react (graph visualization)
- lucide-react (icons)

## API Coverage

Covers all 47 non-OAuth endpoints from the Neotoma OpenAPI spec. See the plan document for the complete endpoint-to-UI mapping.

## Integration

This app is designed to be added as a git submodule to the main Neotoma repo:

```bash
git submodule add <repo-url> inspector
```

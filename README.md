# GoWild Dashboard

Live airport-first dashboard for Frontier GoWild availability. See `docs/` for
the full product/architecture/design/database/API specs this app implements:

- `docs/architecture.md` — stack and infrastructure decisions
- `docs/prd.md` — product requirements, MVP scope, bucket-timing rules
- `docs/design.md` — visual design system and page-by-page UX spec
- `docs/database.md` — Postgres schema (see `supabase/migrations/`)
- `docs/api.md` — REST API reference

## Stack

Next.js 15 (App Router, Server Components) · TypeScript · Tailwind CSS v4 ·
Supabase (Postgres, Auth) · Stripe · deployed on Vercel.

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in your Supabase project's
   URL/keys, an `INTERNAL_API_TOKEN` (any random string — shared with the
   scraping worker), and Stripe keys if you're working on billing.

3. Apply the database schema to your Supabase project:

   ```bash
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```

4. Run the dev server:

   ```bash
   npm run dev
   ```

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run lint` / `npm run lint:fix` | ESLint |
| `npm run format` / `npm run format:check` | Prettier |
| `npm run typecheck` | `tsc --noEmit` |

## Architecture notes

- `src/lib/data/*` is the single data-access layer — both Server Components
  and `src/app/api/v1/*` Route Handlers call the same functions, so the page
  rendering and the public API never drift apart.
- `src/app/internal/v1/scrape-results` is the only write path into
  `route_states`/`route_events`. It's authenticated with `INTERNAL_API_TOKEN`,
  not a user session, and is meant to be called by a separate scraping worker
  service (not part of this repo — see `docs/architecture.md` §4-5).
- Row Level Security (`supabase/migrations/20260630121200_*.sql`) is the real
  security boundary: Server Components and Route Handlers talk to Postgres
  directly via the user's session, there's no separate backend trust boundary.

## Deployment

This app deploys to Vercel with no special configuration — connect the repo
and set the environment variables from `.env.example` in the Vercel project
settings. The scraping worker described in `docs/architecture.md` is a
separate deployable (Fly.io/Railway) and is not part of this repository.

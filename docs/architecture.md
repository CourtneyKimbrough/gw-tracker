# GoWild Dashboard — Technical Architecture

Before the stack, the thing that actually drives every decision below: **this product's hard problem is not the web app — it's the scraping engine.** The dashboard itself is a thin, highly-cacheable read layer over state that a background system maintains. Optimize for that, and the framework/db/deployment choices become easy.

A second framing point: read traffic and write traffic have completely different shapes here. Reads (users browsing airport pages) are bursty, cacheable, and cheap. Writes (scrape results) are constant, scheduled, and the real scaling bottleneck. Most architecture mistakes in this kind of product come from treating both the same way.

---

## 1. Data model (foundation for everything else)

- **Airport** — origin codes you serve (ORD, DEN, LAS...)
- **Route** — origin → destination pair
- **RouteState** (materialized, one row per route) — `status` (available / recently_released / sold_out / unknown), `first_detected_available_at`, `sold_out_at`, `last_checked_at`, `seats_remaining` (nullable)
- **RouteEvent** — append-only log of state transitions (became available, sold out) — this is what powers "average sell-out time" and "historical sell-out times"
- **ScrapeSnapshot** — raw poll results, short retention, used for debugging and `last_checked_at` accuracy, not for serving the dashboard

The dashboard never computes "what's available right now" by scanning raw snapshots. It reads `RouteState`, which the worker updates. This single decision is what makes the read path trivially fast and cacheable.

---

## 2. Framework: Next.js (App Router)

**Why:**
- Airport pages need to be fast on first load with no client-side spinner — Server Components let you fetch `RouteState` server-side and stream HTML immediately. This matters a lot for the "click airport, see dashboard instantly" UX goal.
- API routes co-located with the app remove the need for a separate backend service for the read API.
- ISR / short-TTL caching at the edge fits this data perfectly: it changes every 30-60s, not every request.
- Large ecosystem, easy hiring, good defaults — for a solo/small-team SaaS, boring-and-popular beats novel.

**Why not SvelteKit/Remix/etc.:** they're fine technically, but Next.js's edge-caching story and Vercel's deployment integration specifically save you work on the one part of this app (fast cached reads) that needs to feel instant. Not a strong technical moat either way — pick Next.js for the ecosystem/deployment leverage, not because alternatives are worse.

**Live feel without WebSockets:** the underlying data only changes as fast as your scraper polls (minutes, not milliseconds), so a real-time transport is unjustified complexity. Client-side polling via SWR/React Query (every 20-30s) against a cached API endpoint gives the "live ticker" feel with a fraction of the operational burden of WebSockets/SSE. Revisit this only if you later want sub-minute push notifications for premium users.

---

## 3. Database: Postgres (via Supabase or Neon)

**Why Postgres:** the data is fundamentally relational — airports, routes, state, event history — with real query needs (joins for "average sell-out time per route," filtering by status, etc.). Nothing here needs a document store or a dedicated time-series DB at the volumes involved (a few hundred routes × polls every few minutes is tens of thousands of rows/day, not millions/second).

**Why Supabase specifically (recommended) over a bare RDS/Neon setup:** for a lean team shipping a SaaS, vendor consolidation is a real architectural win, not a nice-to-have. Supabase gives you Postgres + Auth + (optional) Realtime + Storage under one bill and one dashboard. That removes three separate integration decisions (auth provider, realtime infra, file storage) you'd otherwise have to wire up yourself.

**Alternative worth naming:** Neon if you specifically want serverless autoscaling + database branching per PR (nice for a Vercel-centric workflow) and you're fine pairing it with Clerk for auth separately. Slightly more "best of breed," slightly more moving parts. Default to Supabase unless you have a reason to want Neon's branching workflow.

**Don't reach for TimescaleDB yet.** It's tempting because "historical sell-out times" sounds like a time-series problem, but at this data volume a plain `RouteEvent` table with an index on `(route_id, occurred_at)` plus a nightly rollup table (`daily_route_stats`) for averages will outperform the complexity of adding a Timescale extension. Revisit only if raw snapshot volume becomes a real storage/query problem (see Scaling).

---

## 4. Background jobs / scraping scheduler: dedicated worker service + queue

**Why not just Vercel Cron / QStash hitting serverless functions:** serverless functions have execution time limits and cold starts, and scraping at scale needs sustained control over concurrency, retry/backoff, and (realistically) IP/header rotation to avoid getting blocked by Frontier's bot defenses. Serverless is the wrong shape for "constantly running, rate-aware, stateful polling."

**Recommended:** a standalone Node.js (or Python) worker process running BullMQ on Redis (Upstash for managed Redis), deployed on Fly.io or Railway as a long-running service, separate from the Next.js app.

- A **scheduler** enqueues per-route scrape jobs on a cadence.
- **Worker(s)** consume the queue, hit Frontier's booking/calendar endpoints, diff results against current `RouteState`, write transitions to `RouteEvent`, update `RouteState`.
- Decoupling this from the web tier means you can scale scraping throughput (more workers) independently of web traffic, and a scraper crash/block doesn't take down the dashboard — it just means data goes stale, which is a much safer failure mode.

**Polling cadence should be tiered, not uniform.** Releases cluster around specific windows (overnight, based on observed timestamps like 12:01 AM, 12:03 AM, 12:41 AM). Poll aggressively (every 1-2 min) during known high-activity windows and routes with a history of fast sell-outs; poll infrequently (every 15-30 min) during dead hours and for low-interest routes. This is both a cost control and a stealth/rate-limit consideration.

**Flag explicitly:** scraping an airline's booking system is very likely against their Terms of Service, even if technically straightforward. This isn't a tooling decision, it's a business/legal risk decision — worth a deliberate "are we comfortable with this" conversation before investing heavily, independent of how well the architecture is built. Treat resilience-to-blocking as a first-class architectural requirement, not just a performance nicety.

---

## 5. Scraping architecture (the core engine)

- **Target the calendar/month-view endpoint, not single-date search**, if Frontier's site exposes one (most airline booking UIs do, to render the low-fare calendar). One request per route can return weeks of availability instead of one date per request — this is the single biggest lever on request volume.
- **Headless browser (Playwright) as a fallback, not the default**, only if requests need a real browser session/cookies to pass bot detection (Akamai/PerimeterX are common on airline sites). Headless is 10-50x more expensive per check than a direct API call, so try direct HTTP first and escalate only where required.
- **Distinguish "no availability" from "scrape failed."** A blocked request or a layout change must never silently render as "sold out" on the dashboard. Give `RouteState` an explicit `stale`/`error` status, separate from `sold_out`, and surface "last checked" honestly when data is stale rather than showing confidently wrong info.
- **Snapshot-then-diff, not snapshot-then-display.** Every poll writes a raw `ScrapeSnapshot`; the worker compares it to current `RouteState` and only writes a `RouteEvent` (and bumps the dashboard cache) on an actual transition. This keeps the event history meaningful and keeps write volume to the hot `RouteState` table low.
- **Failure-spike alerting.** A sudden rise in scrape errors across many routes simultaneously is your earliest signal that Frontier changed their site or started blocking you — this needs to page someone, not silently degrade.

---

## 6. API structure

Two distinct surfaces, intentionally separated:

**Public read API** (`/api/v1/...`) — serves the dashboard, cache-first:
- `GET /api/v1/airports` — list, for the airport picker
- `GET /api/v1/airports/:code/dashboard` — the categorized lists (available / recently released / sold out today), served from the cached materialized state, never computed live
- `GET /api/v1/airports/:code/routes/:dest` — detail view (history, avg sell-out time, snapshot of seats-remaining trend if available)

Versioning from day one (`/v1/`) is cheap insurance — if this becomes a community resource (it's the kind of thing FlyerTalk/Reddit GoWild communities would want programmatic access to), you'll want a stable contract, and possibly a paid-API tier later as a second monetization path.

**Internal ingestion path** — the worker writes to Postgres directly (or via an internal endpoint behind a service token, not the public API). Keep this off the public API surface entirely; it has different auth, different failure handling, and no reason to share a contract with the read API.

---

## 7. Authentication

**The core dashboard must be usable with zero login** — that's a stated product requirement and also good growth strategy: a no-friction public dashboard is the thing people share links to.

Auth is only needed for account-gated features:
- Saved/favorite airports, default airport on visit
- Premium alerts (push/email/SMS when a specific route opens)
- Multi-airport tracking, historical export/analytics
- Billing (Stripe) for the premium tier

**Recommended:** Supabase Auth (free if already on Supabase for the DB — one less vendor) with magic-link or Google OAuth as the primary flow. No passwords to manage, minimal signup friction for the moment a free user decides they want alerts. Clerk is a fine alternative if you want a more polished pre-built UI component set and don't mind the extra vendor.

---

## 8. Caching strategy

1. **Materialized state in Postgres** (`RouteState`) — the worker, not the read path, does the computation. Reads are simple `SELECT`s.
2. **Redis (Upstash) in front of Postgres** for the per-airport dashboard payload — TTL ~30-60s, explicitly invalidated by the worker when it writes a state change for that airport. This is the layer that absorbs traffic spikes (e.g., a route going viral on Reddit) without touching Postgres at all.
3. **Edge/CDN caching via Vercel** on the API responses and rendered pages, short `max-age` + `stale-while-revalidate` — most requests for a popular airport never even reach your application server.
4. **Client-side polling (SWR)** at ~20-30s intervals against the cached endpoint — gives the live-ticker feel cheaply.

The guiding principle: nothing in this product needs sub-minute precision (the underlying scrape cadence is the real bottleneck), so don't build caching as if it does.

---

## 9. Deployment topology

- **Next.js app → Vercel.** Best-fit for the edge-caching/ISR story above, zero-ops, good preview-deploy workflow.
- **Worker/scraper → Fly.io or Railway** as a persistent process (not serverless) — needs to run continuously, manage queue consumption, and have stable outbound networking for proxy rotation if/when that becomes necessary.
- **Postgres + Auth → Supabase** (managed, handles backups/connection pooling).
- **Redis/queue → Upstash** (serverless-billed, pairs naturally with both Vercel and the worker without managing Redis infra yourself).

This gives you three independently-scalable pieces (web, worker, data) without managing any servers directly, which matches a small team's operational capacity.

---

## 10. Scaling strategy

**Read/user traffic** scales almost for free because of the caching layers above — a viral airport page is a CDN/Redis cache-hit problem, not a database problem. Postgres read replicas are a "much later" concern, if ever.

**Scrape/write throughput is the real constraint**, and it scales with `airports tracked × routes per airport × poll frequency`. Plan for it explicitly:
- Start with Frontier's actual network (~100 airports, far fewer real GoWild routes) rather than every theoretical pair.
- Scale by adding queue workers horizontally as airport coverage grows, not by polling everything faster.
- Tiered polling cadence (section 5) is the primary lever before adding compute.
- **Raw snapshot storage will outgrow everything else if left unmanaged** — set a retention policy (e.g., 30-90 days of raw `ScrapeSnapshot` rows) and roll older data into daily aggregate stats (`avg_sellout_minutes`, etc.) for the historical-trend features. This keeps the hot tables small and queries fast indefinitely.
- Single-region (US, near where Frontier's systems and your user base are) is correct for a long time — this is a US-domestic-airline product, not a global one. Multi-region is not a near-term concern.

---

## Summary table

| Concern | Choice | Core reason |
|---|---|---|
| Framework | Next.js (App Router) | Fast cached reads, SSR for instant dashboards, no real-time transport needed |
| Database | Postgres (Supabase) | Relational fit; Supabase consolidates DB+Auth+Realtime for a small team |
| Background jobs | BullMQ + Redis worker on Fly.io/Railway | Scraping needs sustained, rate-aware, long-running control — not serverless |
| Deployment | Vercel (web) + Fly.io/Railway (worker) + Supabase + Upstash | Each tier scales independently, zero server management |
| Auth | Supabase Auth, login optional | Core dashboard must stay zero-friction; auth only gates premium features |
| Scraping | Calendar-endpoint polling, tiered cadence, snapshot-then-diff | Minimizes requests, distinguishes failure from "sold out," survives detection risk |
| API | Public cached `/v1` read API + separate internal ingestion path | Different consumers, different failure modes, future API monetization option |
| Caching | Postgres materialized state → Redis → CDN → client polling | Multi-layer cache absorbs traffic; nothing needs sub-minute precision |
| Scaling | Tiered polling + retention/rollup, reads scale via cache | Writes (scraping) are the real bottleneck, not user traffic |

**Open risk to resolve before heavy investment:** the ToS/legal exposure of scraping Frontier's booking system. It doesn't change the architecture much, but it should change how much is invested before validating the business can survive being noticed.

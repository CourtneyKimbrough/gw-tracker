# GoWild Dashboard — Database Schema

Source of truth for the actual DDL is `supabase/migrations/`. This doc explains *why* each table exists and how they relate — read it alongside the migrations, not instead of them. Schema derives directly from `docs/prd.md` §6 and the write/read-path split described in `docs/architecture.md` §1.

## Entity-relationship summary

```
airports (code PK)
   ├──< routes.origin_airport_code
   ├──< routes.destination_airport_code
   └──< users.home_airport_code               (Phase 2, optional)

routes (id PK)
   ├──1 route_states (route_id PK/FK, 1:1)
   ├──< route_events
   ├──< scrape_snapshots                       (partitioned by month)
   ├──< daily_route_stats
   ├──< alert_subscriptions                    (Phase 3)
   └──< notification_log                       (Phase 3)

users (id PK, Phase 2)
   ├──1 subscriptions (user_id unique FK, 1:1, Phase 3)
   ├──< alert_subscriptions                    (Phase 3)
   └──< notification_log                       (Phase 3)

route_events (id PK)
   └──< notification_log.route_event_id        (optional, nullable)
```

`<` = one-to-many, `1` = one-to-one.

## Tables

### `airports`
**Why it exists:** defines which airports get their own dashboard at all — the root of every URL (`/ORD`). `timezone` is required, not optional, because "Sold Out Today" is defined in `docs/prd.md` §4 as a *local calendar day*, and that can't be computed correctly without knowing the airport's timezone.

| Column | Type | Notes |
|---|---|---|
| `code` | `text` | **PK.** IATA code, checked `^[A-Z]{3}$`. Natural key — used directly in URLs, no surrogate ID needed. |
| `name`, `city` | `text` | Display fields. |
| `timezone` | `text` | IANA tz name (e.g. `America/Chicago`). |
| `is_tracked` | `boolean` | Whether this airport currently has an active dashboard. Lets ops disable an airport without deleting its history. |
| `created_at` | `timestamptz` | |

**Index:** partial index on `is_tracked` rows — backs the airport-list endpoint, which only shows tracked airports.

---

### `routes`
**Why it exists:** one row per origin→destination pair being tracked. This is what the scraping scheduler enqueues jobs against, and what the dashboard joins against to list an airport's destinations.

| Column | Type | Notes |
|---|---|---|
| `id` | `bigint identity` | **PK.** Surrogate, since this is the FK target for every high-volume child table. |
| `origin_airport_code`, `destination_airport_code` | `text` | **FK →** `airports(code)`, `ON DELETE RESTRICT` (deleting an airport with live routes should fail loudly, not cascade-delete history). |
| `is_active` | `boolean` | Whether the scraper is currently polling this route. |
| `polling_tier` | `enum` | `high` / `standard` / `low` — directly backs the tiered polling cadence strategy in `docs/architecture.md` §5; the scheduler reads this to decide how often to enqueue a job. |
| `created_at` | `timestamptz` | |

**Constraints:** `UNIQUE (origin_airport_code, destination_airport_code)`; `CHECK (origin <> destination)`.

**Indexes:** partial index on `origin_airport_code WHERE is_active` — this is the dashboard's single hottest query (`docs/architecture.md` describes this as the read path everything else caches in front of). Plain index on `destination_airport_code` for the reverse lookup.

---

### `route_states`
**Why it exists:** the materialized "current truth" the dashboard reads. Per `docs/architecture.md` §1, the dashboard *never* computes status by scanning raw snapshots — it reads this table, which the scraping worker updates after every poll. One row per route, strict 1:1.

| Column | Type | Notes |
|---|---|---|
| `route_id` | `bigint` | **PK and FK →** `routes(id)`, `ON DELETE CASCADE`. Sharing the PK with the FK is what enforces the 1:1 relationship. |
| `status` | `enum` | `unknown` / `available` / `sold_out` only — see note below. |
| `first_detected_available_at` | `timestamptz` | |
| `sold_out_at` | `timestamptz` | |
| `last_available_at` | `timestamptz` | Last time it was *observed* available, even after selling out — lets you compute "how long was it available" after the fact. |
| `last_checked_at` | `timestamptz` | |
| `seats_remaining` | `smallint`, nullable | `CHECK (>= 0)`. Best-effort per `docs/prd.md` §4 — expected null for most routes at MVP. |
| `consecutive_error_count` | `smallint` | |
| `updated_at` | `timestamptz` | Auto-touched by trigger on every update. |

**Why `status` has only 3 values:** "Recently Released" is *not* stored here. It's computed by the read API as `status = 'available' AND first_detected_available_at within the last 6 hours` (the exact rule from `docs/prd.md` §4). Keeping that 6-hour threshold out of the schema means it's a tunable application constant, not a migration.

**Indexes:** on `status` (global queries); on `last_checked_at` (staleness detection / failure-spike alerting per `docs/architecture.md` §5).

**Integrity trigger:** an `AFTER INSERT` trigger on `routes` automatically creates the matching `route_states` row, so the 1:1 invariant is enforced by the database rather than trusted to application code.

---

### `route_events`
**Why it exists:** append-only transition log — the source of truth for "historical sell-out times" and "average sell-out time" (`docs/prd.md` §3, §6). Only written on an actual state change (`docs/architecture.md` §5: "snapshot-then-diff, not snapshot-then-display"), so it stays small relative to `scrape_snapshots` despite being the higher-value table.

| Column | Type | Notes |
|---|---|---|
| `id` | `bigint identity` | **PK.** |
| `route_id` | `bigint` | **FK →** `routes(id)`, `ON DELETE CASCADE`. |
| `event_type` | `enum` | `became_available` / `sold_out` / `scrape_error`. |
| `occurred_at` | `timestamptz` | |
| `metadata` | `jsonb`, nullable | E.g. an error code for `scrape_error` events, without needing a schema change later. |

**Indexes:** `(route_id, occurred_at desc)` — the Route Detail page's primary query. `(event_type, occurred_at desc)` — backs the nightly rollup job and network-wide ops queries.

---

### `scrape_snapshots`
**Why it exists:** the highest-volume table in the system — one row per poll, regardless of whether anything changed. Never read by the dashboard; exists for debugging, `last_checked_at` accuracy, and audit.

| Column | Type | Notes |
|---|---|---|
| `id` | `bigint identity` | Part of composite PK. |
| `route_id` | `bigint` | **FK →** `routes(id)`, `ON DELETE CASCADE`. |
| `checked_at` | `timestamptz` | Partition key. |
| `success` | `boolean` | Distinguishes a failed scrape from a real "sold out" — critical per `docs/architecture.md` §5 ("a blocked request must never silently render as sold out"). |
| `raw_status`, `raw_payload` | `text`, `jsonb` | Raw scrape output. |

**PK:** `(id, checked_at)` — composite because Postgres requires the partition key to be part of the primary key on a range-partitioned table.

**Partitioning:** `RANGE (checked_at)`, monthly partitions. This is what makes the documented 30-90 day retention policy (`docs/architecture.md` §10) cheap — dropping a month is a near-instant `DROP TABLE` instead of a slow `DELETE` + `VACUUM`. Partition creation isn't automated by the migrations; production should schedule `pg_cron` (or `pg_partman`) to create future partitions ahead of time.

**Index:** `(route_id, checked_at desc)` for per-route debugging lookups.

---

### `daily_route_stats`
**Why it exists:** nightly rollup of `route_events` into one row per route per day, so "average sell-out time" stays a fast query indefinitely without scanning the full event log or the partitioned snapshot table (`docs/architecture.md` §3: this rollup is explicitly why TimescaleDB isn't needed yet).

| Column | Type | Notes |
|---|---|---|
| `route_id`, `stat_date` | `bigint`, `date` | **Composite PK.** |
| `was_available` | `boolean` | |
| `sellout_duration_minutes` | `integer`, nullable | `CHECK (>= 0)`. |
| `created_at` | `timestamptz` | |

**Index:** on `stat_date` alone — the PK doesn't serve cross-route trend queries (e.g. "network-wide average sell-out speed this week"), which scan across routes for one date range.

---

### `users` *(Phase 2)*
**Why it exists:** backs login, saved home airport, and is the parent for `alert_subscriptions`/`subscriptions` in Phase 3.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | **PK.** Not generated to be independent — when paired with Supabase Auth (`docs/architecture.md` §7), this is expected to equal `auth.users.id`, set by application code at signup. |
| `email` | `text` | Case-insensitive uniqueness enforced via a functional index on `lower(email)`, not a plain unique constraint. |
| `home_airport_code` | `text`, nullable | **FK →** `airports(code)`, `ON DELETE SET NULL`. |
| `created_at` | `timestamptz` | |

---

### `alert_subscriptions` *(Phase 3)*
**Why it exists:** backs the "Notify me" toggle on the Route Detail page (`docs/design.md` §4/§6) — created from that page at the moment of intent, not from the Notifications page.

| Column | Type | Notes |
|---|---|---|
| `id` | `bigint identity` | **PK.** |
| `user_id` | `uuid` | **FK →** `users(id)`, `ON DELETE CASCADE`. |
| `route_id` | `bigint` | **FK →** `routes(id)`, `ON DELETE CASCADE`. |
| `channel` | `enum` | `email` / `push` / `sms`. |
| `created_at` | `timestamptz` | |

**Constraint:** `UNIQUE (user_id, route_id, channel)` — prevents duplicate subscriptions from a double-tap.

**Indexes:** on `route_id` (the worker's "who watches this route" query when a `became_available` event fires); on `user_id` (the Notifications page's "Active alerts" list).

---

### `notification_log` *(Phase 3)*
**Why it exists:** not a named entity in `docs/prd.md` §6, but required to implement the Notifications page's "History" section specified in `docs/design.md` §6 — added here as a necessary supporting table, not scope creep.

| Column | Type | Notes |
|---|---|---|
| `id` | `bigint identity` | **PK.** |
| `user_id` | `uuid` | **FK →** `users(id)`, `ON DELETE CASCADE`. |
| `route_id` | `bigint` | **FK →** `routes(id)`, `ON DELETE CASCADE`. |
| `route_event_id` | `bigint`, nullable | **FK →** `route_events(id)`, `ON DELETE SET NULL` — links a notification to the transition that triggered it, without making the log depend on event-log retention. |
| `channel` | `enum` | |
| `sent_at` | `timestamptz` | |

**Index:** `(user_id, sent_at desc)` — the Notifications page's history query.

---

### `subscriptions` *(Phase 3, billing)*
**Why it exists:** backs the Settings page's plan/subscription row (`docs/design.md` §5) and gates premium-only features. One-to-one with `users` — the product only needs a single active plan per account; Stripe remains the system of record for invoice history.

| Column | Type | Notes |
|---|---|---|
| `id` | `bigint identity` | **PK.** |
| `user_id` | `uuid` | **FK →** `users(id)`, `UNIQUE`, `ON DELETE CASCADE` — enforces 1:1. |
| `stripe_customer_id`, `stripe_subscription_id` | `text`, nullable, `UNIQUE` | |
| `plan` | `enum` | `free` / `premium`. |
| `status` | `enum` | `inactive` / `active` / `past_due` / `canceled`. |
| `current_period_end` | `timestamptz`, nullable | |
| `created_at`, `updated_at` | `timestamptz` | `updated_at` auto-touched by trigger. |

## Migration files

Located in `supabase/migrations/`, applied in order via `supabase db push`:

1. `20260630120000_create_enums.sql`
2. `20260630120100_create_helper_functions.sql`
3. `20260630120200_create_airports.sql`
4. `20260630120300_create_routes.sql`
5. `20260630120400_create_route_states.sql`
6. `20260630120500_create_route_events.sql`
7. `20260630120600_create_scrape_snapshots.sql`
8. `20260630120700_create_daily_route_stats.sql`
9. `20260630120800_create_users.sql` *(Phase 2)*
10. `20260630120900_create_alert_subscriptions.sql` *(Phase 3)*
11. `20260630121000_create_notification_log.sql` *(Phase 3)*
12. `20260630121100_create_subscriptions.sql` *(Phase 3)*

Files 1-8 are sufficient for MVP per `docs/prd.md` §4. Files 9-12 are not needed until accounts/alerts/billing ship.

**Not yet live-tested against a real Postgres instance** — the local Postgres on this machine required a password that wasn't available, and Docker's daemon wasn't running at the time these were written. Run `supabase db push` (or start Docker) and re-verify before relying on this in production; the migrations were reviewed manually but not executed.

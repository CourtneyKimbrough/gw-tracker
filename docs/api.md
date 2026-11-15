# GoWild Dashboard — REST API

Every endpoint maps to a specific page in `docs/design.md` or a table in `docs/database.md`. Read this alongside those two docs.

## Conventions

- **Base URL:** `/api/v1` — versioned from day one per `docs/architecture.md` §6, since this is the kind of data (community/FlyerTalk-relevant) that could become a paid third-party API later.
- **Auth:** Bearer JWT (Supabase Auth token) on authenticated endpoints. Public read endpoints (the entire core dashboard experience) require **no auth at all** — same "never make the user log in to browse" rule from the PRD, applied to the API layer.
- **Pagination:** cursor-based (`?cursor=...` → `next_cursor` in response), used only where lists are genuinely unbounded (history, activity feed). The airport list isn't paginated — at MVP scale (~10-30 airports) that would be unnecessary ceremony.
- **Errors:** uniform shape across every endpoint:
```json
{ "error": { "code": "not_found", "message": "No tracked airport with code XYZ." } }
```
- **Caching:** read endpoints return `Cache-Control: public, max-age=20, stale-while-revalidate=40`, matching the multi-layer cache strategy in `docs/architecture.md` §8 — the contract itself enforces that nothing here is sub-minute real-time.
- **Naming:** collection + item convention (`/airports`, `/airports/{code}`). Routes use an `{origin}-{destination}` slug (e.g. `ORD-DEN`) as the identifier — clean, human-readable, no lookup needed to resolve a route to an internal ID.

---

## Public Read API (no auth) — the entire MVP surface

### `GET /api/v1/airports`
**Why:** backs the Airport Selection page (`docs/design.md` §2) — the list a user picks from once, ever.
```json
{
  "airports": [
    { "code": "ORD", "name": "Chicago O'Hare", "city": "Chicago", "available_count": 7 },
    { "code": "DEN", "name": "Denver International", "city": "Denver", "available_count": 4 }
  ]
}
```
`available_count` exists specifically for the design's "tiny live-count dot per row" — a glanceable signal before tapping in.

### `GET /api/v1/airports/{code}`
**Why:** lightweight metadata-only lookup — used for page `<title>`/OG tags and to validate a code before the full dashboard payload loads. Cheap and separate from the dashboard call so a bad/unknown code fails fast without paying for the bucket query.
```json
{ "code": "ORD", "name": "Chicago O'Hare", "city": "Chicago", "timezone": "America/Chicago" }
```

### `GET /api/v1/airports/{code}/dashboard`
**Why:** the core endpoint — the entire product, in one response. Returns the three buckets exactly as defined in `docs/prd.md` §4, read from the materialized `route_states` table (`docs/database.md`), never computed live.
```json
{
  "airport": { "code": "ORD", "name": "Chicago O'Hare", "city": "Chicago" },
  "updated_at": "2026-06-30T14:32:10Z",
  "data_status": "fresh",
  "currently_available": [
    {
      "destination": { "code": "DEN", "city": "Denver" },
      "first_detected_available_at": "2026-06-29T08:14:00Z",
      "last_checked_at": "2026-06-30T14:31:50Z"
    }
  ],
  "recently_released": [
    {
      "destination": { "code": "PDX", "city": "Portland" },
      "first_detected_available_at": "2026-06-30T00:01:00Z",
      "last_checked_at": "2026-06-30T14:31:50Z"
    }
  ],
  "sold_out_today": [
    {
      "destination": { "code": "SEA", "city": "Seattle" },
      "sold_out_at": "2026-06-30T00:41:00Z",
      "last_checked_at": "2026-06-30T14:31:50Z"
    }
  ]
}
```
`data_status: "fresh" | "stale"` exists because of the data-trust requirement in `docs/prd.md` §4 — the client must be able to render the "data may be delayed" banner honestly rather than presenting possibly-wrong status with false confidence. Empty buckets are returned as empty arrays rather than omitted (unlike the UI, the API stays uniform — it's the client's job to hide an empty "Recently Released" section, per `docs/design.md` §3).

### `GET /api/v1/routes/{origin}-{destination}`
**Why:** the Route Detail page's core data (`docs/design.md` §4) — current status plus the "key facts" stat module.
```json
{
  "route": { "origin": "ORD", "destination": "DEN" },
  "status": "available",
  "first_detected_available_at": "2026-06-29T08:14:00Z",
  "sold_out_at": null,
  "last_checked_at": "2026-06-30T14:31:50Z",
  "seats_remaining": null,
  "average_sellout_minutes": 187,
  "stats_confidence": "low"
}
```
`seats_remaining` is `null`, not omitted — the client renders the field conditionally, per the design spec's explicit rule of never showing a fake "N/A". `stats_confidence: "low"` is how the API expresses "not enough history yet" (`docs/design.md` §4) without the client guessing from a suspiciously small sample size — and `average_sellout_minutes` is computed from `daily_route_stats`, not from scanning `route_events` per-request.

### `GET /api/v1/routes/{origin}-{destination}/history`
**Why:** split out from the detail endpoint on purpose — the stat module above should render instantly, while history is a separate, potentially-long, lazily-loadable list (`docs/design.md` §4 describes it as a distinct section). Paginated because, unlike everything else in this API, history genuinely grows unbounded over a route's lifetime.
```json
{
  "events": [
    { "event_type": "sold_out", "occurred_at": "2026-06-28T09:12:00Z" },
    { "event_type": "became_available", "occurred_at": "2026-06-28T05:32:00Z" }
  ],
  "next_cursor": "eyJvY2N1cnJlZF9hdCI6IjIwMjYtMDYtMjhUMDU6MzI6MDBaIn0="
}
```

### `GET /api/v1/recent`
**Why:** the one endpoint that doesn't scope to a single airport — a network-wide feed of the most recent `became_available`/`sold_out` transitions across *every* tracked airport. Not redundant with the dashboard's "Recently Released" bucket (airport-scoped) — this exists for the landing page's live-proof widget (`docs/design.md` §1) and for power users/community bots watching the whole network rather than one airport, a use case named directly in `docs/prd.md` §2.
```json
{
  "events": [
    { "airport": "ORD", "destination": "DEN", "event_type": "became_available", "occurred_at": "2026-06-30T12:01:00Z" },
    { "airport": "PHX", "destination": "LAS", "event_type": "sold_out", "occurred_at": "2026-06-30T11:58:00Z" }
  ],
  "next_cursor": "eyJvY2N1cnJlZF9hdCI6IjIwMjYtMDYtMzBUMTE6NTg6MDBaIn0="
}
```

---

## Account / Settings (Phase 2, auth required)

Signup/login itself is **not** a custom endpoint — it's handled directly by the Supabase Auth client SDK (magic link / Google OAuth) per `docs/architecture.md` §7. A parallel `/login` endpoint here would just duplicate what Supabase already provides.

### `GET /api/v1/me`
**Why:** backs the Settings page's identity rows (`docs/design.md` §5).
```json
{ "id": "c9e1f2a0-...", "email": "user@example.com", "home_airport": "ORD", "plan": "free" }
```

### `PATCH /api/v1/me`
**Why:** the Settings page saves immediately on change, no "Save" button (`docs/design.md` §5) — this is the endpoint "change home airport" actually calls.
```json
// request
{ "home_airport": "DEN" }
// response: same shape as GET /me
```

### `DELETE /api/v1/me`
**Why:** the Settings page's "danger zone" account deletion (`docs/design.md` §5). Returns `204 No Content`.

---

## Alerts & Notifications (Phase 3, auth required)

### `POST /api/v1/alerts`
**Why:** the "Notify me" toggle that lives directly on the Route Detail page (`docs/design.md` §6) — alerts are created at the moment of intent, not from a separate creation flow.
```json
// request
{ "route": "ORD-DEN", "channel": "push" }
// response 201
{ "id": 4821, "route": { "origin": "ORD", "destination": "DEN" }, "channel": "push", "created_at": "2026-06-30T14:40:00Z" }
```
Duplicate `(user, route, channel)` requests return the existing subscription rather than erroring — toggling twice should be idempotent, not a visible failure.

### `GET /api/v1/alerts`
**Why:** the Notifications page's "Active alerts" list (`docs/design.md` §6).
```json
{
  "alerts": [
    { "id": 4821, "route": { "origin": "ORD", "destination": "DEN" }, "channel": "push", "created_at": "2026-06-30T14:40:00Z" }
  ]
}
```

### `DELETE /api/v1/alerts/{id}`
**Why:** the remove action on each row of that same list. Returns `204 No Content`.

### `GET /api/v1/notifications`
**Why:** the Notifications page's "History" section (`docs/design.md` §6) — what was actually sent, separate from what's currently being watched.
```json
{
  "notifications": [
    {
      "id": 991,
      "route": { "origin": "ORD", "destination": "DEN" },
      "channel": "push",
      "event_type": "became_available",
      "sent_at": "2026-06-30T12:01:05Z"
    }
  ],
  "next_cursor": null
}
```

---

## Billing (Phase 3, auth required)

### `POST /api/v1/billing/checkout-session`
**Why:** the Settings page's plan row needs an upgrade action (`docs/design.md` §5) — creates a Stripe Checkout session and hands the client a redirect URL, keeping PCI scope entirely on Stripe's side.
```json
{ "checkout_url": "https://checkout.stripe.com/c/pay/cs_test_..." }
```

### `POST /api/v1/billing/portal-session`
**Why:** "manage/cancel plan" — same pattern, redirects into Stripe's hosted billing portal instead of building cancellation UI ourselves.
```json
{ "portal_url": "https://billing.stripe.com/p/session/..." }
```

### `POST /api/v1/webhooks/stripe`
**Why:** not client-facing — Stripe calls this server-to-server (signature-verified) to push subscription status changes into the `subscriptions` table. Listed for completeness since billing can't function without it, but it's a system integration point, not part of the public API contract.

---

## Internal — scraper ingestion (not part of the public API)

### `POST /internal/v1/scrape-results`
**Why:** `docs/architecture.md` §6 is explicit that the write path stays off the public API surface entirely — different auth (service token, not user JWT), different failure handling, no reason to share a versioned contract with `/api/v1`. This is what the scraping worker calls after every poll; it writes the `scrape_snapshots` row and runs the diff logic that may update `route_states` and append a `route_events` row.
```json
// request, service-token authenticated
{ "route": "ORD-DEN", "checked_at": "2026-06-30T14:31:50Z", "success": true, "raw_status": "available", "seats_remaining": null }
```

Deliberately **not** included: public CRUD endpoints for managing `airports`/`routes`. Per the PRD, the tracked-airport list is curated/admin-managed at MVP — a direct DB operation or internal admin tool, not public API surface.

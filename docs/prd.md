# GoWild Dashboard — Product Requirements Document

## 0. Problem Statement

Frontier's GoWild pass holders currently have no fast way to answer "what can I fly right now from my airport?" Existing tools are search engines — they require picking dates and destinations before showing anything. That's the wrong model for a pass where availability is volatile, opens/closes without warning, and rewards speed. GoWild Dashboard replaces "search" with "look" — an airport-specific live board, like a flight departure screen, with zero required input.

---

## 1. Target Users

| Segment | Description | Primary need |
|---|---|---|
| **Active GoWild pass holders** (primary) | Already paid for the unlimited pass, tied to one or two home airports | Fast, low-effort answer to "what's flyable right now" — speed matters because availability disappears |
| **Prospective GoWild buyers** | Evaluating whether the pass is worth it before purchasing | Evidence of how good/bad availability typically is from their airport, before committing money |
| **Deal-community power users** | FlyerTalk, r/frontier, GoWild Facebook groups | Track multiple airports, share dashboard links, spot patterns other members can act on |
| **(Future) Content creators** | Cover GoWild as a recurring topic | Embeddable/shareable data, possibly API access |

The primary persona to design for is the **active pass holder checking their phone during a known release window** — this user is impatient, often half-asleep (release events cluster overnight per the product's own examples), and will bounce instantly if the page makes them think.

---

## 2. Primary Use Cases

1. **Quick check** — "I have GoWild from ORD. What's available right now?" → open app, land on saved/detected airport, scan three buckets, done in under 5 seconds.
2. **Release watching** — "It's near midnight, a release event might happen." → user keeps the dashboard open/refreshing during a known active window, watching the "Recently Released" bucket.
3. **Pre-purchase evaluation** — "Is GoWild worth it from PHX?" → user looks at a route's historical sell-out pattern before buying the pass.
4. **Tracking a specific target** — "I want to fly to Denver eventually." → user wants to know when Denver moves from sold-out to available (this is the seed of the alerting feature, deferred past MVP).
5. **Sharing** — user shares a direct link to their airport's dashboard or a specific route's history page in a community thread.

---

## 3. Core Features (Full Product Vision)

1. **Airport-first dashboard** — zero required input; URL-addressable per airport (`/ORD`); auto-detected or remembered default airport.
2. **Three-bucket live view** — Currently Available / Recently Released / Sold Out Today, each destination with a relevant timestamp.
3. **Route detail page** — first detected available time, sold-out time, average sell-out duration, historical sell-out log, seats remaining (where detectable), last checked time.
4. **Auto-refreshing data** — dashboard updates without manual reload (polling-based, ~20-30s).
5. **Airport switcher** — fast way to check a second airport without re-navigating from scratch.
6. **Saved home airport** — remembers the user's airport across visits.
7. **Alerts** *(post-MVP)* — notify when a specific sold-out route reopens.
8. **Historical analytics/trends** *(post-MVP)* — charts of sell-out speed over time per route.
9. **Accounts + premium subscription** *(post-MVP)* — gates alerts, multi-airport tracking, export.
10. **Public API** *(future)* — read access to live/historical data for community tooling.

---

## 4. MVP Scope

MVP goal: prove that the zero-input, airport-first model is something people actually use repeatedly — not to monetize yet. Everything below must be precisely defined since it determines what an engineer builds.

### In scope for MVP

- **Coverage:** Frontier GoWild only. Launch with a curated list of airports Frontier actually serves with GoWild-eligible routes (not all Frontier destinations) — start with the top 10-15 highest-traffic GoWild airports, expand from there. Hard-coded/admin-managed list, not auto-discovered.
- **Dashboard page per airport**, no login required, three buckets as defined below.
- **Bucket definitions (exact rules, no ambiguity for the engineer):**
  - **Currently Available** — route status is `available` AND it has been available for longer than the "recently released" window (see below). Sorted by destination name or by remaining estimated time (TBD by data availability).
  - **Recently Released** — route status is `available` AND `first_detected_available_at` is within the last **6 hours** (configurable constant, not hardcoded business logic scattered in code). Shown with the detected time. A route appears in *either* Recently Released *or* Currently Available, never both.
  - **Sold Out Today** — route status is `sold_out` AND `sold_out_at` falls on the current calendar day **in the airport's local timezone**. Rolls off the list at local midnight (becomes part of history, not deleted).
- **Route detail page** — `first_detected_available_at`, `sold_out_at` (if applicable), `last_checked_at`, and a simple average sell-out time computed from available history (even if sparse at launch — show "not enough data yet" rather than a misleading number). Full historical chart/visualization is explicitly **not** MVP (see roadmap) — a basic list/table of past events is sufficient.
- **Seats remaining** — field exists in the data model from day one but is expected to be **null for most/all routes at MVP launch**, since GoWild fare buckets typically don't expose seat counts. This is "populate if detectable," not a committed MVP feature — do not block launch on it.
- **Data freshness transparency** — every dashboard explicitly shows "last checked" timestamps; if a route's data is stale beyond a threshold (scrape failures), show a "data may be delayed" state rather than silently showing possibly-wrong status. This is a trust requirement, not a nice-to-have.
- **Responsive web app only.** No native iOS/Android app.
- **No accounts, no payments in MVP.** Home-airport preference can be stored client-side (cookie/localStorage) rather than requiring an account.

### Explicitly deferred out of MVP (but in scope for the product overall)

- Accounts/login, saved favorites tied to a user
- Alerts/notifications
- Premium tier / billing
- Historical charts/visualizations
- Multi-airport personalized dashboard
- Public API

---

## 5. Future Roadmap

**Phase 2 — Accounts & History**
Accounts (email/OAuth login), persisted favorite airport, full route history pages with charts, refined average sell-out statistics, expanded airport coverage beyond the initial curated list.

**Phase 3 — Alerts & Monetization**
Email/push notification when a specific sold-out route reopens; Stripe-backed premium subscription gating alerts and multi-route tracking; this is the first real revenue mechanism.

**Phase 4 — Power User & Ecosystem**
Multi-airport unified view (for users who fly from more than one home base), public read API (potential paid tier for community tool builders), improved seats-remaining detection if Frontier's data ever supports it, PWA push notifications.

**Phase 5 — Expansion (uncertain, evaluate later)**
If other carriers launch comparable unlimited-flight passes, consider generalizing beyond Frontier. Not committed — flagging only so the data model isn't accidentally Frontier-hardcoded in ways that would block this later (e.g., keep "GoWild" as a named program rather than baking Frontier-only assumptions into core entities).

---

## 6. Database Entities

(Entity-level spec — fields and purpose, not implementation. Matches and extends `docs/architecture.md`'s data model.)

| Entity | Key fields | Purpose |
|---|---|---|
| **Airport** | code, name, city, timezone, is_tracked | Defines which airports have dashboards; timezone is required for correct "today" bucketing |
| **Route** | origin_airport_id, destination_airport_id, is_active | One row per origin→destination pair being tracked |
| **RouteState** | route_id, status (`available` \| `sold_out` \| `unknown`/`error`), first_detected_available_at, sold_out_at, last_available_at, last_checked_at, seats_remaining (nullable), consecutive_error_count | The materialized "current truth" the dashboard reads — never computed live from raw snapshots |
| **RouteEvent** | route_id, event_type (`became_available` \| `sold_out` \| `scrape_error`), occurred_at | Append-only log; source of historical sell-out data and average calculations |
| **ScrapeSnapshot** | route_id, checked_at, raw_status, success (bool), raw_payload | Raw poll results; short retention, debugging/audit only, not read by the dashboard |
| **DailyRouteStat** | route_id, date, sellout_duration_minutes (nullable), was_available (bool) | Rollup table for historical trend queries once raw snapshots age out |
| **User** *(Phase 2)* | id, email, home_airport_id | Account identity, once accounts exist |
| **AlertSubscription** *(Phase 3)* | user_id, route_id, channel, created_at | What a user wants to be notified about |
| **Subscription/Billing** *(Phase 3)* | user_id, stripe_customer_id, plan, status | Premium gating |

`RouteState` is the single most important entity in the system — it's what makes the dashboard fast and what every bucket rule in Section 4 reads from.

---

## 7. Success Metrics

**Primary (validates the core bet — that zero-input browsing drives repeat use):**
- **Return rate**: % of visitors who come back within 7 days without any prompt (email/push) — this is the signal that "just check the dashboard" is a habit, not a one-time curiosity visit.
- **Time-to-first-meaningful-paint** on an airport dashboard (target: near-instant; this is a UX requirement, not just a vanity metric, given the impatient-user persona).

**Engagement:**
- DAU/WAU and sessions per week per returning user (release-watching behavior should produce multiple short sessions, especially overnight).
- % of sessions landing directly on an airport page vs. bouncing from a generic homepage.

**Data quality / trust (these are product-health metrics, not just ops metrics):**
- Scrape success rate per route (% of scheduled checks that succeed).
- Median data staleness across all tracked routes at any given moment.
- Rate of user-reported "this looks wrong" feedback (worth instrumenting even at MVP, e.g. a lightweight report-an-issue control).

**Coverage / growth:**
- Number of airports and routes actively tracked.
- Organic/referral traffic to airport pages (community-shared links are a leading indicator of product-market fit for this audience).

**Business (Phase 3+):**
- Premium conversion rate, alert-subscriber count, MRR.

---

## 8. Risks

| Risk | Why it matters | Notes |
|---|---|---|
| **ToS / legal exposure of scraping Frontier** | The entire product depends on data Frontier doesn't officially provide; this is a business-continuity risk, not just a technical one | Recommend legal review before significant investment; design for graceful degradation, not just technical workarounds |
| **Anti-bot / site-change fragility** | Frontier can change their booking flow or strengthen bot detection with no notice, breaking the scraper | Mitigated by failure-spike alerting (see `architecture.md` §5), but residual risk is permanent and ongoing, not a one-time fix |
| **Data trust collapse** | If the dashboard shows "sold out" when it's actually available (or vice versa), users lose trust immediately and won't come back — this audience checks fast and acts fast | Staleness must be surfaced honestly (Section 4); never let a scrape failure silently render as a confident status |
| **Single source-of-truth dependency** | If Frontier discontinues or restructures GoWild, the product has no fallback business | Worth monitoring Frontier's public statements about the program's future |
| **Narrow TAM** | Total addressable market is GoWild pass holders specifically — a small, niche audience | Community-driven distribution (Reddit/FlyerTalk) is likely the primary growth channel, not paid acquisition |
| **Unproven willingness to pay** | Free dashboard is the core value; unclear how many users will pay for alerts/premium | MVP intentionally has no monetization — validate engagement before betting on conversion |
| **Seats-remaining may be undeliverable** | Listed as a target feature, but GoWild fare buckets may never expose seat counts | Treat as best-effort throughout the roadmap, not a committed feature; avoid promising it externally |
| **Competitive response** | Existing GoWild search tools could copy the dashboard model; Frontier could build this officially and remove the gap this product fills | Speed-to-market and community trust are the realistic moat, not technical complexity |

---

## 9. Out of Scope

Explicitly **not building**, to keep engineering focused and prevent scope creep back toward "another search engine":

- **No booking or transactional flow.** This product never touches purchasing, PNRs, or Frontier's checkout — read-only monitoring only.
- **No user-driven date/destination search.** This is the exact model being intentionally avoided — no search form, ever, in the core experience.
- **No support for airlines other than Frontier** in the near-to-mid term (Phase 5 is speculative, not committed).
- **No native mobile apps** — responsive web only through at least Phase 4.
- **No fare/price tracking.** GoWild is a flat-rate pass; this is not a price-comparison or fare-alert tool, and the product should avoid drifting toward that adjacent-but-different category.
- **No social/community features** (comments, forums, user profiles beyond basic account settings) in the near term.
- **No multi-passenger or companion-pass logic** in MVP.
- **No sub-minute real-time push (WebSocket-grade "live").** Polling-based freshness (~20-30s) is an intentional, justified choice per `architecture.md`, not a placeholder for something more real-time later.

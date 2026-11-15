# GoWild Dashboard — Visual & UX Design Spec

## Design Foundations (apply to every page)

These are the rules that make the product feel like Linear/Stripe/Vercel rather than a generic "admin panel" SaaS — they exist to keep every page-level decision below consistent.

- **Color:** near-black background (`#0A0A0B`-range, not pure `#000` — pure black causes harsh contrast against white text and reads cheap). One elevated surface tone for cards/rows (slightly lighter than background, no heavy borders — separation comes from subtle background contrast, not strokes). One accent color used sparingly (a single brand hue, e.g. a cool blue) reserved for primary actions and the "recently released" signal only — not sprinkled everywhere. Status communicated through *muted* color + iconography, not saturated traffic-light red/green/yellow (that reads as a stock-ticker toy, not a precision tool).
- **Typography:** one geometric sans for UI text (Inter/Geist-class), one monospace for all data — airport codes, timestamps, durations, counts. The mono/sans split is doing real product work: it visually distinguishes "data you're scanning" from "labels explaining it," the same trick Linear and Vercel use for IDs and timestamps.
- **Spacing:** 8px base unit, generous vertical rhythm between sections. Whitespace is the primary way hierarchy is communicated — not borders, not boxes, not shadows.
- **Motion:** fast (150-200ms), functional only — status-change pulses, skeleton-to-content fades. No decorative animation, no parallax, nothing that delays the user from reading data.
- **Iconography:** minimal line icons (16-20px), used only where they remove ambiguity (back arrow, refresh, bell). No illustrations, no empty-state graphics — text alone carries empty states.
- **No unnecessary controls, as a rule, not a slogan:** every screen gets evaluated for "does this control need to exist." Default to omitting filters, sorts, tabs, and settings until a real user need forces them in. This single rule is why there's no sidebar, no dashboard chrome, no settings tree below.

**Global navigation philosophy:** there is no persistent sidebar or bottom tab bar. The dashboard is a single-purpose screen, not an app shell with five destinations competing for attention. Anonymous mobile users (the majority, per the PRD — login is optional) should never see navigation chrome for features they're not using. The only persistent global element is a small, top-right account affordance that reveals Settings/Notifications — present but visually quiet, since those are low-frequency pages (Phase 2/3 features per the PRD).

**Layout philosophy:** mobile-first means single-column by default, and the dashboard *stays* single-column even at desktop width — centered, max-width content column (similar to Linear's changelog or Stripe's docs), not a wide multi-panel BI layout. This is a deliberate rejection of the "admin dashboard with sidebar and 6 widgets" pattern; the product is a list to scan, not a data console to configure.

**Perceived performance:** skeleton placeholders match the exact final layout (no spinners). Because the architecture renders dashboard data server-side, most loads should show real content immediately, with skeletons reserved for the rare slow/cold case.

---

## 1. Landing Page

**Purpose:** convert a cold visitor into someone looking at their own airport's data within seconds — not a brochure page.

**Component hierarchy:**
- **Nav bar** (minimal height): wordmark, left. Single low-weight "Sign in" text link, right. No pricing link, no nav menu — there is nothing else to navigate to pre-product.
- **Hero:**
  - Headline: short, functional, not aspirational marketing copy (e.g., a single sentence stating what the product shows, not what it "empowers" you to do).
  - One-line subheadline.
  - **The airport picker lives directly in the hero** — not behind a "Get Started" button. This is the product, so it's the primary on-screen element, full-width on mobile, autofocused input with type-ahead.
- **Live proof section, directly below the fold:** an embedded, real, auto-updating mini-dashboard for one popular airport. This replaces typical "trusted by" logos or screenshots — showing genuinely live data is stronger social proof for this product than testimonials, and it's honest (Linear's own marketing site leans on this same "show the real product" instinct).
- **Three-column explainer** (stacks to one column on mobile): mirrors the dashboard's three buckets — Available / Recently Released / Sold Out — each with a one-line description. This primes the mental model before the user ever clicks in, so the dashboard needs zero onboarding once they arrive.
- **Footer:** minimal link list, no newsletter signup, no social icons grid.

**UX decisions:**
- Browser geolocation/IP is used to pre-suggest the nearest airport directly in the hero picker (e.g., placeholder text becomes "ORD — Chicago O'Hare" instead of generic placeholder), but never auto-navigates without a tap — respects user control while honoring the "never type an airport" promise from the very first visit.
- No pricing page in the nav at MVP, since premium doesn't exist yet — adding it would imply a feature gate that isn't real, undermining trust before the user's even tried the product.

---

## 2. Airport Selection Page

**Purpose:** the one explicit "choose" moment in the product. Should be visited once by most users, ever — designed for speed, not exploration.

**Component hierarchy:**
- **Search input:** large, autofocused, filters the list live as the user types (no submit step).
- **Suggested airport card:** sits above the list, visually distinct (slightly elevated), pre-filled from geolocation — "Use ORD · Chicago O'Hare" with a single tap to confirm. For most users this card alone completes the flow.
- **Flat list below:** airport code (mono, bold) + city name per row. At MVP scale (10-30 airports) this stays a simple list — no regional grouping, no map view, no multi-select. A tiny live-count dot per row (e.g., number of currently-available routes) gives a glanceable signal before even entering, rewarding the tap.
- **Empty/no-match state:** one line of text ("No airports found"), nothing decorative.

**UX decisions:**
- After first selection, the choice persists (local storage), and this page is skipped entirely on return visits — it's a utility, not a destination, and shouldn't be over-designed as if it were a core screen.
- A small "switch airport" affordance lives in the dashboard header for the rare repeat visit, rather than this page being part of the primary navigation loop.

---

## 3. Airport Dashboard (the core page)

**Purpose:** the entire product's value is delivered here. Must be scannable in under two seconds.

**Component hierarchy:**
- **Header (sticky, short):** airport code (large, mono) + city name; small "switch" tap target next to it; relative last-updated indicator top-right ("Updated 12s ago," ticking live). No logo-heavy branding competing with the data here.
- **Three vertically stacked sections, always single-column** (this is a board to read top-to-bottom, not a dashboard to scan left-to-right):
  1. **Currently Available** — section label + count. Rows sorted alphabetically (deterministic and scannable, not algorithmically reordered — predictability matters more than cleverness for a list people check repeatedly).
  2. **Recently Released** — same row style, plus a small accent-colored "new" dot and relative timestamp ("Released 12m ago"). This is the only section that uses the brand accent color, which makes genuinely new releases visually pop against an otherwise restrained palette — exactly the moment that deserves a user's attention.
  3. **Sold Out Today** — visually deprioritized: muted text color, lower contrast, smaller timestamp. This is reference information, not actionable, so it should recede rather than compete with the top two sections.
- **Row anatomy** (shared across all three sections): destination name (primary, sans), timestamp (mono, secondary), thin left-edge color bar indicating status rather than full-row background tinting — keeps the page from looking like a traffic-light grid. Entire row is the tap target → Route Detail page.
- **Section omission, not empty states:** if "Recently Released" has nothing, the section header doesn't render at all — no "Nothing here yet" placeholder. One less thing on screen to read.
- **Staleness banner:** appears only when data exceeds a freshness threshold — a single quiet inline line ("Data may be delayed"), not a modal or alert color. Honesty about data quality (per the PRD's trust requirement) without being alarming.

**UX decisions:**
- Status color is restrained on purpose: available = default text color (the unmarked, expected state), recently released = the one accent color in the whole app, sold out = muted gray. Nothing is rendered in saturated red/green — that reads as a toy, not a tool someone checks at 6am to make a decision.
- Pull-to-refresh is supported on mobile as a reassurance gesture even though auto-polling already keeps data current — users will try it instinctively, and it should work even though it's not load-bearing.
- Absolute timestamp available on tap/hover of any relative time — same convention this audience already knows from GitHub/Linear, so it needs no explanation.

---

## 4. Route Detail Page

**Purpose:** secondary, optional depth for users evaluating a specific destination — pre-purchase research or pattern-watching, per the PRD's use cases.

**Component hierarchy:**
- **Header:** back affordance to the dashboard; route shown as plain text breadcrumb ("ORD → Denver"); current status as a single prominent badge at the top (Available / Recently Released / Sold Out).
- **Key-facts module:** a small set of stat rows/cards — First detected, Sold out at (only if applicable today), Last checked, Average sell-out time. **Seats remaining is rendered only when non-null** — omitted entirely rather than shown as "N/A," consistent with the PRD's framing of it as best-effort, not a guaranteed field. Single column on mobile, two-column grid on wider viewports.
- **Historical log:** a clean reverse-chronological text list of past events ("Sold out — Mar 4, 9:12 AM · available for 3h 40m"). No chart at this stage — per the PRD, visualization is explicitly deferred, and a well-typeset list fits the text-forward aesthetic better than a placeholder chart would.
- **No external or transactional links.** No "book this flight" button, no link out to Frontier's site — the page stays strictly informational, matching the PRD's out-of-scope boundary.

**UX decisions:**
- The page is built to be shared: clean, stable URL, since community link-sharing is a named use case in the PRD. A live-status OG image is a good later enhancement, not required now.
- If history is too sparse for a meaningful average, the page says so plainly ("Not enough history yet") instead of showing a misleading number or an empty chart shell.

---

## 5. Settings Page

**Purpose:** Phase 2 utility page (requires accounts). Kept deliberately small — this product doesn't have enough configurable surface area to justify a settings "app within the app."

**Component hierarchy:**
- Single column, flat list of labeled rows — no tabs, no sidebar:
  - Home airport (current value + change action, reuses the Airport Selection page rather than duplicating that UI)
  - Email / account identity
  - Notification preferences (a link out to the Notifications page, not inlined here, keeping this page short)
  - Plan/subscription status (Phase 3): a simple text-plus-action row, not a pricing table — this is account management, not a sales surface
  - Sign out
- **Danger zone** (delete account) at the very bottom: visually de-emphasized, separated by spacing rather than a heavy red box — present but not shouting, the same restraint Linear/Stripe apply to destructive actions.

**UX decisions:**
- Every control saves immediately on change — no "Save" button anywhere on this page. A toggle or dropdown that requires a separate save click is exactly the kind of unnecessary control this design language exists to eliminate.

---

## 6. Notifications Page

**Purpose:** Phase 3 management/review surface for route alerts — not where alerts are created.

**Component hierarchy:**
- **Active alerts:** a short list — destination name + remove action per row. Expected to stay short for this product's scale, so no search, filters, or batch actions.
- **History:** reverse-chronological list of past notifications sent ("Denver became available — 2 days ago").
- **Empty state for Active alerts:** one line of guidance text, no illustration — pointing the user toward where alerts actually get created (see below), not offering a redundant creation flow on this page.

**UX decisions:**
- The "Notify me" toggle for a route lives **on the Route Detail page itself**, at the exact moment a user is looking at a sold-out destination and deciding they care — not on this Notifications page, which would force a detour away from the moment of intent. Notifications is purely for reviewing/managing what's already set up.
- Push permission is requested only when the user taps "Notify me" for the first time, never on app load or account creation — respecting attention and avoiding a permission prompt with no context behind it.

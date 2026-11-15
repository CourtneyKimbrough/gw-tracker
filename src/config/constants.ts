/**
 * "Recently Released" window, per docs/prd.md §4: a route appears in
 * Recently Released (instead of Currently Available) while it has been
 * available for less than this many hours. Tunable application constant —
 * deliberately not stored in the database (see docs/database.md, route_states).
 */
export const RECENTLY_RELEASED_WINDOW_HOURS = 6;

/**
 * If route_states.last_checked_at is older than this, the dashboard must show
 * data as stale rather than presenting a possibly-wrong status with false
 * confidence (docs/prd.md §4, docs/architecture.md §5).
 */
export const STALE_DATA_THRESHOLD_MINUTES = 15;

/** Minimum number of historical sell-out events before showing an average. */
export const MIN_EVENTS_FOR_CONFIDENT_AVERAGE = 5;

export const DEFAULT_PAGE_SIZE = 25;

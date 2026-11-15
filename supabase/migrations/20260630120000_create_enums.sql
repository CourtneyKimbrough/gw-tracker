-- Status is intentionally only 3 values. "Recently Released" is NOT stored here —
-- it's derived by the read API as (status = 'available' AND first_detected_available_at
-- within the last N hours), per docs/prd.md §4. Keeping that threshold out of the
-- schema keeps it a tunable application constant instead of a migration.
create type route_status as enum ('unknown', 'available', 'sold_out');

create type route_event_type as enum ('became_available', 'sold_out', 'scrape_error');

-- Drives the scraping scheduler's tiered polling cadence (docs/architecture.md §5).
create type polling_tier as enum ('high', 'standard', 'low');

create type alert_channel as enum ('email', 'push', 'sms');

create type subscription_plan as enum ('free', 'premium');

create type subscription_status as enum ('inactive', 'active', 'past_due', 'canceled');

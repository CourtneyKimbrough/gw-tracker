-- Phase 3 (docs/prd.md §5). Backs the "Notify me" toggle on the Route Detail page
-- (docs/design.md §4/§6).
create table alert_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references users(id) on delete cascade,
  route_id bigint not null references routes(id) on delete cascade,
  channel alert_channel not null,
  created_at timestamptz not null default now(),
  unique (user_id, route_id, channel)
);

-- The worker's notification-trigger query: "who watches this route" whenever a
-- became_available route_event is written.
create index idx_alert_subscriptions_route on alert_subscriptions (route_id);

-- Backs the Notifications page's "Active alerts" list (docs/design.md §6).
create index idx_alert_subscriptions_user on alert_subscriptions (user_id);

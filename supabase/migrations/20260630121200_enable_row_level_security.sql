-- The app talks to Postgres through the anon key + user JWT directly from
-- Server Components and Route Handlers (src/lib/supabase/server.ts) — there is
-- no separate backend trust boundary. RLS is therefore the actual security
-- boundary for this schema, not optional hardening.

-- Public, read-only reference/state data: anyone (including signed-out
-- visitors browsing a dashboard) can read it; nothing except the internal
-- ingestion route (which uses the service-role client and bypasses RLS
-- entirely) is allowed to write it.
alter table airports enable row level security;
alter table routes enable row level security;
alter table route_states enable row level security;
alter table route_events enable row level security;
alter table daily_route_stats enable row level security;

create policy "airports are publicly readable" on airports for select using (true);
create policy "routes are publicly readable" on routes for select using (true);
create policy "route_states are publicly readable" on route_states for select using (true);
create policy "route_events are publicly readable" on route_events for select using (true);
create policy "daily_route_stats are publicly readable" on daily_route_stats for select using (true);

-- Raw scrape data is never read by the app (docs/architecture.md §5) and isn't
-- meant for public consumption. RLS is enabled with no policies at all, so
-- only the service-role client (which bypasses RLS) can touch it.
alter table scrape_snapshots enable row level security;

-- Account data: a user may only see and manage their own rows.
alter table users enable row level security;

create policy "users can view their own row" on users
  for select using (auth.uid() = id);
create policy "users can insert their own row" on users
  for insert with check (auth.uid() = id);
create policy "users can update their own row" on users
  for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "users can delete their own row" on users
  for delete using (auth.uid() = id);

alter table alert_subscriptions enable row level security;

create policy "users can view their own alerts" on alert_subscriptions
  for select using (auth.uid() = user_id);
create policy "users can create their own alerts" on alert_subscriptions
  for insert with check (auth.uid() = user_id);
create policy "users can delete their own alerts" on alert_subscriptions
  for delete using (auth.uid() = user_id);

-- Notifications and billing are written by the worker / Stripe webhook via the
-- service-role client only — users can read their own history but never write it.
alter table notification_log enable row level security;

create policy "users can view their own notification history" on notification_log
  for select using (auth.uid() = user_id);

alter table subscriptions enable row level security;

create policy "users can view their own subscription" on subscriptions
  for select using (auth.uid() = user_id);

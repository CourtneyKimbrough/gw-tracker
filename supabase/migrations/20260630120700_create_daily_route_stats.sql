-- Nightly rollup of route_events into one row per route per day. Keeps "average
-- sell-out time" queries fast indefinitely without scanning the full event log
-- or the partitioned snapshot table (docs/architecture.md §3).
create table daily_route_stats (
  route_id bigint not null references routes(id) on delete cascade,
  stat_date date not null,
  was_available boolean not null default false,
  sellout_duration_minutes integer check (sellout_duration_minutes is null or sellout_duration_minutes >= 0),
  created_at timestamptz not null default now(),
  primary key (route_id, stat_date)
);

-- Backs cross-route trend queries (e.g. network-wide average sell-out speed this week),
-- which the (route_id, stat_date) primary key alone doesn't serve.
create index idx_daily_route_stats_date on daily_route_stats (stat_date);

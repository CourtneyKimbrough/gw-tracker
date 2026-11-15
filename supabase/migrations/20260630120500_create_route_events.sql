-- Append-only transition log: written only when route_states actually changes
-- (snapshot-then-diff, not snapshot-then-display — docs/architecture.md §5).
-- Source of truth for "historical sell-out times" and "average sell-out time".
create table route_events (
  id bigint generated always as identity primary key,
  route_id bigint not null references routes(id) on delete cascade,
  event_type route_event_type not null,
  occurred_at timestamptz not null default now(),
  metadata jsonb
);

-- Route Detail page's primary query: reverse-chronological history for one route.
create index idx_route_events_route_occurred on route_events (route_id, occurred_at desc);

-- Backs the nightly rollup job and network-wide ops queries (e.g. "routes sold out today").
create index idx_route_events_type_occurred on route_events (event_type, occurred_at desc);

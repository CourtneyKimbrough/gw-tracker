-- The materialized "current truth" the dashboard reads. The worker is the only writer;
-- the read API never computes this from scrape_snapshots or route_events directly
-- (docs/architecture.md §1, §8).
create table route_states (
  route_id bigint primary key references routes(id) on delete cascade,
  status route_status not null default 'unknown',
  first_detected_available_at timestamptz,
  sold_out_at timestamptz,
  last_available_at timestamptz,
  last_checked_at timestamptz,
  seats_remaining smallint check (seats_remaining is null or seats_remaining >= 0),
  consecutive_error_count smallint not null default 0,
  updated_at timestamptz not null default now()
);

create index idx_route_states_status on route_states (status);

-- Backs staleness detection / failure-spike alerting (docs/architecture.md §5).
create index idx_route_states_last_checked_at on route_states (last_checked_at);

create trigger route_states_touch_updated_at
before update on route_states
for each row
execute function touch_updated_at();

-- Every route has exactly one route_states row. Enforce that invariant at the
-- database level instead of trusting application code to insert both rows.
create or replace function create_route_state_for_new_route()
returns trigger
language plpgsql
as $$
begin
  insert into route_states (route_id) values (new.id);
  return new;
end;
$$;

create trigger routes_after_insert_create_state
after insert on routes
for each row
execute function create_route_state_for_new_route();

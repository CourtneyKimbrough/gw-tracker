-- The highest-volume table in the system: one row per poll, regardless of whether
-- anything changed. Never read by the dashboard (route_states serves that) — this
-- exists for debugging, last_checked_at accuracy, and audit (docs/architecture.md §5).
--
-- Partitioned by month so the documented 30-90 day retention policy
-- (docs/architecture.md §10) is a near-instant `DROP TABLE` on an old partition
-- instead of a slow DELETE + VACUUM. The partition key (checked_at) must be part
-- of the primary key for a range-partitioned table, hence the composite PK.
--
-- Partition creation is not automated by this migration set. In production, either
-- schedule pg_cron to create next month's partition ahead of time, or use
-- pg_partman. A few starter partitions are created below so the table is usable
-- immediately.
create table scrape_snapshots (
  id bigint generated always as identity,
  route_id bigint not null references routes(id) on delete cascade,
  checked_at timestamptz not null default now(),
  success boolean not null,
  raw_status text,
  raw_payload jsonb,
  primary key (id, checked_at)
) partition by range (checked_at);

create index idx_scrape_snapshots_route_checked on scrape_snapshots (route_id, checked_at desc);

create table scrape_snapshots_2026_06 partition of scrape_snapshots
  for values from ('2026-06-01') to ('2026-07-01');

create table scrape_snapshots_2026_07 partition of scrape_snapshots
  for values from ('2026-07-01') to ('2026-08-01');

create table scrape_snapshots_2026_08 partition of scrape_snapshots
  for values from ('2026-08-01') to ('2026-09-01');

create table airports (
  code text primary key check (code ~ '^[A-Z]{3}$'),
  name text not null,
  city text not null,
  timezone text not null,
  is_tracked boolean not null default true,
  created_at timestamptz not null default now()
);

-- Backs GET /api/v1/airports, which only lists tracked (dashboard-enabled) airports.
create index idx_airports_is_tracked on airports (code) where is_tracked;

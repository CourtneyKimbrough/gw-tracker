create table routes (
  id bigint generated always as identity primary key,
  origin_airport_code text not null references airports(code) on delete restrict,
  destination_airport_code text not null references airports(code) on delete restrict,
  is_active boolean not null default true,
  polling_tier polling_tier not null default 'standard',
  created_at timestamptz not null default now(),
  constraint routes_origin_destination_distinct check (origin_airport_code <> destination_airport_code),
  constraint routes_origin_destination_unique unique (origin_airport_code, destination_airport_code)
);

-- The dashboard's primary query: "active routes for this origin airport." Partial
-- index keeps it small as inactive/retired routes accumulate over time.
create index idx_routes_origin_active on routes (origin_airport_code) where is_active;

create index idx_routes_destination on routes (destination_airport_code);

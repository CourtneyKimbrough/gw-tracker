-- Phase 3 billing (docs/prd.md §5). Backs the Settings page's plan/subscription
-- row (docs/design.md §5) and gates premium-only features. One-to-one with users:
-- the product only needs a single active plan per account, not billing history
-- (Stripe itself is the system of record for invoices).
create table subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null unique references users(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  plan subscription_plan not null default 'free',
  status subscription_status not null default 'inactive',
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger subscriptions_touch_updated_at
before update on subscriptions
for each row
execute function touch_updated_at();

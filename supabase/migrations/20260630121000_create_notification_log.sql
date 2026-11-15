-- Not a named entity in docs/prd.md §6, but required to implement the
-- Notifications page's "History" list specified in docs/design.md §6
-- ("reverse-chronological list of past notifications sent").
create table notification_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references users(id) on delete cascade,
  route_id bigint not null references routes(id) on delete cascade,
  route_event_id bigint references route_events(id) on delete set null,
  channel alert_channel not null,
  sent_at timestamptz not null default now()
);

create index idx_notification_log_user_sent on notification_log (user_id, sent_at desc);

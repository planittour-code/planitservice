-- Lightweight product analytics for Portfolio funnel (P0 §3).
-- PM can query 7-day counts: select name, count(*) from analytics_events
--   where created_at > now() - interval '7 days' group by 1;
create table if not exists analytics_events (
  id text primary key,
  name text not null,
  user_id text,
  session_id text,
  portfolio_id text,
  property_id text,
  quote_id text,
  event_key text not null,
  created_at timestamptz not null default now(),
  unique (event_key)
);

create index if not exists analytics_events_name_created_idx
  on analytics_events (name, created_at desc);

create index if not exists analytics_events_created_idx
  on analytics_events (created_at desc);

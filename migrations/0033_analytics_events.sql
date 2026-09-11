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

-- address_mapped: portfolio_properties insert (addPortfolioProperty / map into slot)
create or replace function analytics_track_address_mapped() returns trigger
language plpgsql as $$
declare
  uid text;
  eid text;
begin
  select user_id into uid from portfolios where id = NEW.portfolio_id;
  eid := md5(random()::text || clock_timestamp()::text || NEW.portfolio_id || NEW.property_id);
  insert into analytics_events (id, name, user_id, portfolio_id, property_id, event_key)
  values (
    eid,
    'address_mapped',
    uid,
    NEW.portfolio_id,
    NEW.property_id,
    'address_mapped:' || NEW.portfolio_id || ':' || NEW.property_id
  )
  on conflict (event_key) do nothing;
  return NEW;
end;
$$;

drop trigger if exists analytics_address_mapped_trg on portfolio_properties;
create trigger analytics_address_mapped_trg
  after insert on portfolio_properties
  for each row execute function analytics_track_address_mapped();

-- quote_created: proposals insert (createProposalFromWizard / contractor quote)
create or replace function analytics_track_quote_created() returns trigger
language plpgsql as $$
declare
  eid text;
begin
  eid := md5(random()::text || clock_timestamp()::text || NEW.id);
  insert into analytics_events (id, name, user_id, property_id, quote_id, event_key)
  values (
    eid,
    'quote_created',
    NEW.created_by,
    NEW.property_id,
    NEW.id,
    'quote_created:' || NEW.id
  )
  on conflict (event_key) do nothing;
  return NEW;
end;
$$;

drop trigger if exists analytics_quote_created_trg on proposals;
create trigger analytics_quote_created_trg
  after insert on proposals
  for each row execute function analytics_track_quote_created();

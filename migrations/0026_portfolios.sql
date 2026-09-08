create table if not exists portfolios (
  id text primary key,
  user_id text not null unique,
  name text not null,
  paid_at timestamptz,
  extra_slots int not null default 0,
  included_count int not null default 10,
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz not null default now()
);

create table if not exists portfolio_properties (
  portfolio_id text not null references portfolios(id) on delete cascade,
  property_id text not null references properties(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (portfolio_id, property_id)
);

create index if not exists portfolio_properties_property_idx on portfolio_properties (property_id);

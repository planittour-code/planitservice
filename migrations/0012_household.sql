insert into companies (id, user_id, name, trade, email, onboarded_at)
values (
  'co_household',
  'system-household',
  'PlanitService Household',
  'household',
  null,
  now()
) on conflict (id) do nothing;

update companies set name = 'PlanitService Household' where id = 'co_household';

create table if not exists property_plans (
  property_id text primary key references properties(id) on delete cascade,
  cadence text not null,
  tier text not null default 'standard',
  status text not null default 'active',
  renews_on date not null,
  created_at timestamptz not null default now()
);

create table if not exists maintenance_tasks (
  id text primary key,
  property_id text not null references properties(id) on delete cascade,
  title text not null,
  system_name text not null,
  cadence text not null,
  due_on date not null,
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists maintenance_property_idx on maintenance_tasks (property_id, due_on);

create table if not exists property_transfers (
  id text primary key,
  property_id text not null references properties(id) on delete cascade,
  from_user_id text not null,
  to_email text not null,
  reason text not null,
  token text not null unique,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

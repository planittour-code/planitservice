create table if not exists homeowner_profiles (
  user_id text primary key,
  plan text not null default 'basic',
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists rfps (
  id text primary key,
  share_token text not null unique,
  user_id text not null,
  property_id text references properties(id) on delete set null,
  work_id text not null,
  title text not null,
  body text not null,
  budget text,
  address_line text not null,
  city text not null,
  state text not null,
  zip text not null,
  homeowner_name text not null,
  status text not null default 'open',
  created_at timestamptz not null default now()
);
create index if not exists rfps_open_idx on rfps (status, work_id, created_at desc);
create index if not exists rfps_user_idx on rfps (user_id, created_at desc);

create table if not exists rfp_quotes (
  id text primary key,
  rfp_id text not null references rfps(id) on delete cascade,
  company_id text not null references companies(id) on delete cascade,
  proposal_id text not null references proposals(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (rfp_id, company_id)
);

insert into rfps (
  id, share_token, user_id, property_id, work_id, title, body, budget,
  address_line, city, state, zip, homeowner_name, status, created_at
) values (
  'rfp_maple_roof',
  'maple-roof-rfp',
  'system-demo-homeowner',
  'prop_maple',
  'roof',
  'Reroof before the next storm season',
  'Architectural shingles from 2019 are due. Looking for a complete tear-off, ice and water, and a named product that can live on the House File. South-facing, 6/12, about 24 squares. Access from the driveway.',
  'Under 18,000',
  '142 Maple Street',
  'Marietta',
  'GA',
  '30064',
  'Margaret Hale',
  'open',
  '2026-08-20 10:00:00-04'
) on conflict (id) do nothing;

create table if not exists companies (
  id text primary key,
  user_id text not null unique,
  name text not null,
  trade text not null default 'general',
  phone text,
  email text,
  website text,
  created_at timestamptz not null default now()
);

create table if not exists properties (
  id text primary key,
  company_id text not null references companies(id) on delete cascade,
  share_token text not null unique,
  invite_token text not null unique,
  invite_status text not null default 'pending',
  address_line text not null,
  city text not null,
  state text not null,
  zip text not null,
  homeowner_name text not null,
  homeowner_email text not null,
  homeowner_phone text,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists properties_company_idx on properties (company_id);

create table if not exists property_facts (
  id text primary key,
  property_id text not null references properties(id) on delete cascade,
  field_key text not null,
  value text not null,
  source text not null,
  updated_at timestamptz not null default now(),
  unique (property_id, field_key)
);

create table if not exists property_photos (
  id text primary key,
  property_id text not null references properties(id) on delete cascade,
  src text not null,
  caption text,
  category text not null default 'general',
  uploaded_by text not null,
  created_at timestamptz not null default now()
);
create index if not exists property_photos_property_idx on property_photos (property_id);

create table if not exists templates (
  id text primary key,
  company_id text,
  name text not null,
  trade text not null,
  description text not null,
  cover_note text not null,
  created_at timestamptz not null default now()
);

create table if not exists template_items (
  id text primary key,
  template_id text not null references templates(id) on delete cascade,
  sort_order int not null default 0,
  name text not null,
  description text,
  qty double precision not null default 1,
  unit text not null default 'ls',
  unit_price double precision not null default 0,
  optional boolean not null default false,
  category text,
  manufacturer text,
  product_name text,
  sku text,
  color text,
  warranty_years int,
  warranty_terms text
);

create table if not exists proposals (
  id text primary key,
  company_id text not null references companies(id) on delete cascade,
  property_id text not null references properties(id) on delete cascade,
  template_id text,
  share_token text not null unique,
  title text not null,
  status text not null default 'draft',
  cover_note text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  accepted_at timestamptz
);
create index if not exists proposals_property_idx on proposals (property_id);
create index if not exists proposals_company_idx on proposals (company_id);

create table if not exists proposal_items (
  id text primary key,
  proposal_id text not null references proposals(id) on delete cascade,
  sort_order int not null default 0,
  name text not null,
  description text,
  qty double precision not null default 1,
  unit text not null default 'ls',
  unit_price double precision not null default 0,
  included boolean not null default true,
  optional boolean not null default false,
  category text,
  manufacturer text,
  product_name text,
  sku text,
  color text,
  location_note text,
  warranty_years int,
  warranty_terms text,
  homeowner_note text
);

create table if not exists proposal_messages (
  id text primary key,
  proposal_id text not null references proposals(id) on delete cascade,
  author_role text not null,
  author_name text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists jobs (
  id text primary key,
  company_id text not null references companies(id) on delete cascade,
  property_id text not null references properties(id) on delete cascade,
  proposal_id text,
  title text not null,
  summary text,
  completed_at date not null,
  created_at timestamptz not null default now()
);
create index if not exists jobs_property_idx on jobs (property_id);

create table if not exists job_specs (
  id text primary key,
  job_id text not null references jobs(id) on delete cascade,
  kind text not null,
  label text not null,
  value text not null,
  location_note text,
  manufacturer text,
  product_name text,
  warranty_years int,
  warranty_terms text,
  warranty_expires date
);

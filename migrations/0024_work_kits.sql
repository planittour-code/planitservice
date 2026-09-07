alter table companies add column if not exists kits_seeded_at timestamptz;

create table if not exists work_kits (
  id text primary key,
  company_id text not null references companies(id) on delete cascade,
  work_id text not null,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists work_kits_company_idx on work_kits (company_id, work_id, sort_order);

create table if not exists work_kit_items (
  id text primary key,
  kit_id text not null references work_kits(id) on delete cascade,
  sort_order int not null default 0,
  name text not null,
  description text,
  qty text,
  unit text not null default 'ls',
  slot text
);
create index if not exists work_kit_items_kit_idx on work_kit_items (kit_id, sort_order);

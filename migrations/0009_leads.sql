create table if not exists quote_leads (
  id text primary key,
  query text not null,
  address text not null,
  city text not null default '',
  state text not null default '',
  zip text not null default '',
  work_id text,
  found boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists quote_leads_created_idx on quote_leads (created_at desc);
create index if not exists quote_leads_work_idx on quote_leads (work_id);

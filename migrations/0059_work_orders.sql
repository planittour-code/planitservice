-- Sprint 1 #4: one work order per accepted estimate (proposal).
-- 0058 is reserved for the parallel search-index PR (feat/search-index).
-- Opened by the shop ("Create work order") on an accepted/completed estimate;
-- accept itself does NOT create one. Filing to the Property Record (jobs) is
-- unchanged: it still happens on accept.

alter table companies add column if not exists work_order_seq int not null default 0;

create table if not exists work_orders (
  id text primary key,
  company_id text not null references companies(id) on delete cascade,
  property_id text not null references properties(id) on delete cascade,
  proposal_id text not null references proposals(id) on delete cascade,
  number int not null,
  -- The worker, by email (lowercased). Not required to be a company member.
  assignee_email text
    check (assignee_email is null or (assignee_email = lower(assignee_email) and assignee_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')),
  start_date date,
  end_date date,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'in_progress', 'complete', 'cancelled')),
  notes text,
  -- Contractor toggle: when true the worker-facing email shows line prices + total.
  show_prices boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_orders_proposal_uniq unique (proposal_id),
  constraint work_orders_company_number_uniq unique (company_id, number),
  constraint work_orders_dates_chk check (end_date is null or start_date is null or end_date >= start_date)
);

create index if not exists work_orders_company_status_idx
  on work_orders (company_id, status, start_date);
create index if not exists work_orders_property_idx on work_orders (property_id);

-- Snapshot of the proposal's included line items at creation (no live link).
create table if not exists work_order_items (
  id text primary key,
  work_order_id text not null references work_orders(id) on delete cascade,
  source_item_id text,
  sort_order int not null default 0,
  name text not null,
  description text,
  qty double precision not null default 1,
  unit text not null default 'ls',
  unit_price double precision not null default 0,
  manufacturer text,
  product_name text,
  sku text,
  color text,
  location_note text,
  warranty_years int,
  warranty_terms text
);

create index if not exists work_order_items_wo_idx
  on work_order_items (work_order_id, sort_order);

-- Activity log (modeled on proposal_events, 0056): who, from, to, at.
create table if not exists work_order_events (
  id text primary key,
  work_order_id text not null references work_orders(id) on delete cascade,
  company_id text not null references companies(id) on delete cascade,
  actor text not null,
  kind text not null,
  from_status text,
  to_status text,
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists work_order_events_wo_idx
  on work_order_events (work_order_id, created_at);

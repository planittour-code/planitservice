-- Manufacturer warranty cards captured on a Property Record, keyed by trade.
-- Photos live here so they do not consume the house photo cap.
create table if not exists property_warranties (
  id text primary key,
  property_id text not null references properties(id) on delete cascade,
  trade_id text not null,
  job_id text references jobs(id) on delete set null,
  proposal_id text references proposals(id) on delete set null,
  product_name text,
  manufacturer text,
  serial_number text,
  model_number text,
  color text,
  sku text,
  purchased_on text,
  installed_on text,
  warranty_years integer,
  warranty_expires text,
  coverage text,
  installer_name text,
  registered boolean not null default false,
  register_url text,
  claim_phone text,
  notes text,
  barcode_src text,
  card_src text,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists property_warranties_property_idx
  on property_warranties (property_id, trade_id, updated_at desc);

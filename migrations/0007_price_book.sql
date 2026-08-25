create table if not exists company_members (
  id text primary key,
  company_id text not null references companies(id) on delete cascade,
  user_id text,
  email text not null,
  role text not null default 'sales',
  created_at timestamptz not null default now(),
  unique (company_id, email)
);
create index if not exists company_members_user_idx on company_members (user_id);
create index if not exists company_members_email_idx on company_members (email);

create table if not exists price_book (
  id text primary key,
  company_id text not null references companies(id) on delete cascade,
  trade text not null,
  slot text not null,
  manufacturer text,
  product_name text not null,
  sku text,
  color text,
  unit text not null default 'ea',
  cost double precision,
  sell double precision,
  warranty_years int,
  warranty_terms text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists price_book_company_idx on price_book (company_id, slot);

alter table proposals add column if not exists created_by text;
alter table proposal_items add column if not exists unit_cost double precision;

insert into company_members (id, company_id, email, role)
values ('mem_demo_owner', 'co_demo', 'hello@northsidehome.example', 'owner')
on conflict (company_id, email) do nothing;

insert into price_book (
  id, company_id, trade, slot, manufacturer, product_name, sku, color, unit,
  cost, sell, warranty_years, warranty_terms
) values
  ('pb_int_1', 'co_demo', 'paint', 'interior_paint', 'Sherwin-Williams', 'Cashmere', 'SW 7029', 'Agreeable Gray', 'sf', 0.42, null, null, 'Lifetime washability of the film when applied per spec.'),
  ('pb_int_2', 'co_demo', 'paint', 'interior_paint', 'Sherwin-Williams', 'Cashmere', 'SW 7008', 'Alabaster', 'sf', 0.42, null, null, 'Lifetime washability of the film when applied per spec.'),
  ('pb_int_t', 'co_demo', 'paint', 'interior_trim', 'Sherwin-Williams', 'Emerald Urethane', null, 'Extra White, satin', 'room', 28, null, 15, '15-year film warranty.'),
  ('pb_ext_1', 'co_demo', 'paint', 'exterior_paint', 'Sherwin-Williams', 'Duration Exterior', 'SW 7008', 'Alabaster', 'sf', 0.38, null, 15, '15-year film warranty.'),
  ('pb_ext_t', 'co_demo', 'paint', 'exterior_trim', 'Sherwin-Williams', 'Duration Exterior', null, 'Extra White', 'sf', 0.38, null, 15, '15-year film warranty.'),
  ('pb_door', 'co_demo', 'paint', 'door_paint', 'Sherwin-Williams', 'Emerald Urethane', 'SW 2801', 'Rookwood Red', 'ea', 22, null, 15, '15-year film warranty.'),
  ('pb_sh_1', 'co_demo', 'roofing', 'shingle', 'GAF', 'Timberline HDZ', 'Charcoal', 'Charcoal', 'sq', 112, 300, 50, '50-year limited warranty. Golden Pledge available.'),
  ('pb_sh_2', 'co_demo', 'roofing', 'shingle', 'GAF', 'Timberline HDZ', 'Pewter Gray', 'Pewter Gray', 'sq', 112, 300, 50, '50-year limited warranty. Golden Pledge available.'),
  ('pb_win_1', 'co_demo', 'windows', 'window', 'Andersen', '100 Series', null, null, 'ea', 410, 720, 20, '20-year glass. 10-year hardware when registered.'),
  ('pb_win_2', 'co_demo', 'windows', 'window', 'Pella', 'Impervia', null, null, 'ea', 520, 940, 20, '20-year glass. 10-year hardware when registered.'),
  ('pb_win_3', 'co_demo', 'windows', 'window', 'Marvin', 'Essential', null, null, 'ea', null, null, 20, '20-year glass. 10-year hardware when registered.'),
  ('pb_gt_1', 'co_demo', 'gutters', 'gutter', 'LeafFilter', '6-inch aluminum', null, 'White', 'lf', 4.2, 12, 25, '25-year finish warranty.'),
  ('pb_gt_2', 'co_demo', 'gutters', 'gutter_guard', 'LeafFilter', 'Micromesh', null, null, 'lf', 7.5, 18, null, 'Limited lifetime clog-free warranty.'),
  ('pb_sd_1', 'co_demo', 'siding', 'siding', 'James Hardie', 'HardiePlank', null, 'Arctic White', 'sf', 3.4, 9.4, 30, '30-year substrate. Color Plus 15-year finish.'),
  ('pb_sd_2', 'co_demo', 'siding', 'siding', 'CertainTeed', 'Vinyl', null, 'Colonial White', 'sf', 1.6, 5.6, 25, '25-year fade and hail.'),
  ('pb_st_1', 'co_demo', 'decks', 'stain', 'Ready Seal', 'Ready Seal', 'Dark Walnut', 'Dark Walnut', 'sf', 0.85, 3.4, 3, '3-year maintenance coat recommended.'),
  ('pb_st_2', 'co_demo', 'decks', 'stain', 'Ready Seal', 'Ready Seal', 'Natural Cedar', 'Natural Cedar', 'sf', 0.85, 3.4, 3, '3-year maintenance coat recommended.')
on conflict (id) do nothing;

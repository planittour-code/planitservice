-- Public bookings and complimentary Property Records opened from the mailer / voice agent.
-- Availability itself lives on the shop Google Calendar. These rows are the PlanitService copy.

create table if not exists shop_bookings (
  id text primary key,
  company_id text references companies(id) on delete set null,
  shop_email text not null,
  calendar_event_id text,
  slot_start timestamptz not null,
  slot_end timestamptz not null,
  service text not null,
  name text not null,
  email text not null,
  phone text,
  address_line text,
  confirmation_code text not null,
  source text not null default 'web',
  status text not null default 'booked',
  created_at timestamptz not null default now()
);

create unique index if not exists shop_bookings_slot_live_idx
  on shop_bookings (shop_email, slot_start)
  where status = 'booked';

create index if not exists shop_bookings_company_idx
  on shop_bookings (company_id, slot_start);

alter table proposals
  add column if not exists started_work_at timestamptz;

alter table property_plans
  add column if not exists complimentary_until date;

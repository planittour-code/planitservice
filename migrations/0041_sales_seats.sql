alter table companies add column if not exists extra_seats int not null default 0;

create table if not exists shop_billing_events (
  session_id text primary key,
  company_id text not null references companies(id) on delete cascade,
  kind text not null,
  quantity int not null default 1,
  created_at timestamptz not null default now()
);

alter table work_kits add column if not exists owner_id text;
create index if not exists work_kits_owner_idx on work_kits (company_id, owner_id);

alter table price_book add column if not exists owner_id text;
create index if not exists price_book_owner_idx on price_book (company_id, owner_id);

update companies c
set extra_seats = (
  select count(*)::int from company_members m
  where m.company_id = c.id and m.role = 'sales'
)
where extra_seats = 0;

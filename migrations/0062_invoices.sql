-- Sprint 1 #5: invoice from a work order (AC §5, Counsel §5.7).
-- 0058 / 0060 / 0061 are reserved for the search branches (feat/search-index,
-- feat/search-api); this is the next free number after them.
--
-- Numbering: invoices.number is the legacy proposal-derived number
-- (paymentInvoiceNumber(proposal.id), AC 5.2), so links/PDFs/MX memos already
-- sent for a proposal keep the same number. invoices.seq is a real per-company
-- sequence (companies.invoice_seq) shown as "INV-0001" next to it.
--
-- No payment processing, no card fee. invoice_payments are manual records the
-- shop enters; they and invoice_events are append-only (enforced by trigger).
-- Marking paid writes nothing to jobs / job_specs (AC 5.4).

alter table companies add column if not exists invoice_seq int not null default 0;

create table if not exists invoices (
  id text primary key,
  company_id text not null references companies(id) on delete cascade,
  property_id text not null references properties(id) on delete cascade,
  proposal_id text not null references proposals(id) on delete cascade,
  work_order_id text not null references work_orders(id) on delete cascade,
  seq int not null,
  number text not null,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'partially_paid', 'paid', 'void')),
  issue_date date,
  due_date date,
  notes text,
  sent_at timestamptz,
  paid_at timestamptz,
  voided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Sprint 1: one invoice per WO (AC 5.1).
  constraint invoices_work_order_uniq unique (work_order_id),
  constraint invoices_company_seq_uniq unique (company_id, seq),
  constraint invoices_dates_chk check (due_date is null or issue_date is null or due_date >= issue_date)
);

create index if not exists invoices_company_status_idx on invoices (company_id, status, due_date);
create index if not exists invoices_property_idx on invoices (property_id);
create index if not exists invoices_proposal_idx on invoices (proposal_id);

create table if not exists invoice_items (
  id text primary key,
  invoice_id text not null references invoices(id) on delete cascade,
  source_item_id text,
  sort_order int not null default 0,
  name text not null,
  description text,
  qty double precision not null default 1,
  unit text not null default 'ls',
  unit_price double precision not null default 0
);

create index if not exists invoice_items_invoice_idx on invoice_items (invoice_id, sort_order);

-- Manual payment records. amount > 0 records a payment; a reversal is a new
-- row with a negative amount that points at the row it reverses.
create table if not exists invoice_payments (
  id text primary key,
  invoice_id text not null references invoices(id) on delete cascade,
  company_id text not null references companies(id) on delete cascade,
  amount double precision not null check (amount <> 0),
  method text check (method is null or method in ('check', 'cash', 'card', 'ach', 'other')),
  note text,
  paid_on date not null,
  reverses_id text references invoice_payments(id),
  actor_user_id text,
  actor_label text not null,
  created_at timestamptz not null default now()
);

create index if not exists invoice_payments_invoice_idx on invoice_payments (invoice_id, created_at);
create unique index if not exists invoice_payments_reverses_uniq
  on invoice_payments (reverses_id) where reverses_id is not null;

-- Status / activity log (Counsel's invoice_status_events, §5.7).
create table if not exists invoice_events (
  id text primary key,
  invoice_id text not null references invoices(id) on delete cascade,
  company_id text not null references companies(id) on delete cascade,
  actor_user_id text,
  actor_label text not null,
  kind text not null,
  from_status text,
  to_status text,
  method text,
  note text,
  payment_id text,
  created_at timestamptz not null default now()
);

create index if not exists invoice_events_invoice_idx on invoice_events (invoice_id, created_at);

create or replace function invoice_append_only() returns trigger language plpgsql as $$
begin
  raise exception '% is append-only', tg_table_name;
end;
$$;

drop trigger if exists invoice_payments_append_only on invoice_payments;
create trigger invoice_payments_append_only before update or delete on invoice_payments
  for each row when (pg_trigger_depth() = 0) execute function invoice_append_only();

drop trigger if exists invoice_events_append_only on invoice_events;
create trigger invoice_events_append_only before update or delete on invoice_events
  for each row when (pg_trigger_depth() = 0) execute function invoice_append_only();

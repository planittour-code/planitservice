alter table proposals
  add column if not exists scheduled_on date,
  add column if not exists scheduled_note text;

create index if not exists proposals_scheduled_idx
  on proposals (company_id, scheduled_on);

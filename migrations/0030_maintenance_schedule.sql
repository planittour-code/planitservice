alter table maintenance_tasks
  add column if not exists scheduled_on date,
  add column if not exists scheduled_note text;

create index if not exists maintenance_scheduled_idx
  on maintenance_tasks (property_id, scheduled_on);

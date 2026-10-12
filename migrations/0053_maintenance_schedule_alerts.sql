alter table maintenance_tasks add column if not exists alert_on boolean not null default true;

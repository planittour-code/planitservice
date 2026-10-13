-- One house on a homeowner account can be marked as the primary residence.
alter table properties
  add column if not exists is_primary_residence boolean not null default false;

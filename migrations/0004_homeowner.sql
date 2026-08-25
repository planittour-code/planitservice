alter table properties
  add column if not exists homeowner_user_id text;

create index if not exists properties_homeowner_user_idx
  on properties (homeowner_user_id);

create index if not exists properties_homeowner_email_idx
  on properties (homeowner_email);

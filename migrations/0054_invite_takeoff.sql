-- Homeowner measurements and preferences on a named-shop lead.
alter table file_work_invites
  add column if not exists takeoff_json text;

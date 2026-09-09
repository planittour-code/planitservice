alter table portfolios add column if not exists phone text;
alter table portfolios add column if not exists email text;
alter table portfolios add column if not exists logo_src text;

alter table homeowner_profiles add column if not exists display_name text;
alter table homeowner_profiles add column if not exists phone text;
alter table homeowner_profiles add column if not exists email text;

alter table companies add column if not exists logo_src text;
alter table companies add column if not exists agreement text;
alter table companies add column if not exists terms text;
alter table companies add column if not exists trades text;
alter table companies add column if not exists onboarded_at timestamptz;

update companies
set onboarded_at = coalesce(onboarded_at, created_at)
where onboarded_at is null;

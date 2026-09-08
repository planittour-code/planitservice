alter table companies add column if not exists slug text;
create unique index if not exists companies_slug_uidx on companies (slug);

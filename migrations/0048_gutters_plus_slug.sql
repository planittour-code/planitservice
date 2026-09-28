-- Keep the mailer links /s/gutters-plus/book and /s/gutters-plus/project
-- working even if the shop slug was spelled differently.
insert into shop_slug_aliases (slug, company_id)
select 'gutters-plus', id from companies
where shop_paid_at is not null
  and lower(email) = 'albin@guttersplus.com'
  and not exists (select 1 from companies where slug = 'gutters-plus')
  and not exists (select 1 from shop_slug_aliases where slug = 'gutters-plus')
limit 1
on conflict (slug) do nothing;

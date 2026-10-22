-- Sprint 1 #6: up to 2 generic contractor payment links per shop (label + https URL).
-- Sits alongside payment_link (gutters / generic) and paint_payment_link (paint
-- override); routing for those is unchanged. PlanitService processes nothing.
alter table companies add column if not exists payment_links jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'companies_payment_links_max2') then
    alter table companies add constraint companies_payment_links_max2
      check (jsonb_typeof(payment_links) = 'array' and jsonb_array_length(payment_links) <= 2);
  end if;
end $$;

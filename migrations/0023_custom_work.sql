insert into templates (id, company_id, name, trade, description, cover_note)
values (
  'tmpl_custom',
  null,
  'Custom work',
  'custom',
  'A shop-defined category — pools, fencing, or any other offer.',
  'This estimate is for the work listed at this address.'
)
on conflict (id) do nothing;

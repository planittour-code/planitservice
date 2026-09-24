-- Drainage is its own catalog template. Shops still opt in on Shop settings.

insert into templates (id, company_id, name, trade, description, cover_note)
values (
  'tmpl_drainage',
  null,
  'Drainage',
  'drainage',
  'Leaders, buried pipe, and splash away from the foundation.',
  'The drainage path is written down so the next visit matches this run.'
)
on conflict (id) do nothing;

insert into template_items (
  id, template_id, sort_order, name, description, qty, unit, unit_price, optional, category
) values
  ('ti_dr_1', 'tmpl_drainage', 1, 'Site protection and haul-off', 'Beds, walks, and debris from the drainage run.', 1, 'ls', 180, false, 'prep'),
  ('ti_dr_2', 'tmpl_drainage', 2, 'Exterior drainage', 'Grade, splash, and surface runoff at the downspouts.', 1, 'ls', 240, false, 'drainage'),
  ('ti_dr_3', 'tmpl_drainage', 3, 'Underground drain', 'Leaders into buried pipe away from the foundation.', 40, 'lf', 18, false, 'drainage'),
  ('ti_dr_4', 'tmpl_drainage', 4, 'Above-ground drain', 'Above-grade extensions and splash away from the house.', 4, 'ea', 45, false, 'drainage')
on conflict (id) do nothing;

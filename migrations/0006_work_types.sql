insert into templates (id, company_id, name, trade, description, cover_note) values
(
  'tmpl_windows',
  null,
  'Window replacement',
  'windows',
  'Replace openings with named units and warranties.',
  'Each window is named, counted, and warrantied on the house file.'
),
(
  'tmpl_siding',
  null,
  'Siding replacement',
  'siding',
  'Tear-off, wrap, and a named cladding.',
  'The product on the elevations stays with the address — color, warranty, and all.'
),
(
  'tmpl_porch',
  null,
  'Porch restore',
  'porches',
  'Floor, ceiling, screens, and rail.',
  'The porch finish and screens are written down so the next coat matches.'
)
on conflict (id) do nothing;

insert into template_items
  (id, template_id, sort_order, name, description, qty, unit, unit_price, optional, category, manufacturer, product_name, sku, color, warranty_years, warranty_terms)
values
  ('ti_wn_1', 'tmpl_windows', 1, 'Remove and haul', 'Openings covered same day.', 12, 'ea', 55, false, 'demo', null, null, null, null, null, null),
  ('ti_wn_2', 'tmpl_windows', 2, 'New windows', 'Unit, flashing, and install.', 12, 'ea', 720, false, 'window', 'Andersen', '100 Series', null, null, 20, '20-year glass. 10-year hardware when registered.'),
  ('ti_sd_1', 'tmpl_siding', 1, 'Tear-off and haul', 'Existing siding off.', 1, 'ls', 1800, false, 'demo', null, null, null, null, null, null),
  ('ti_sd_2', 'tmpl_siding', 2, 'Fiber-cement siding', 'Named product on the elevations.', 1, 'house', 9800, false, 'siding', 'James Hardie', 'HardiePlank', null, 'Arctic White', 30, '30-year substrate. Color Plus 15-year finish.'),
  ('ti_pc_1', 'tmpl_porch', 1, 'Wash and prep', 'Floor, posts, failed film.', 1, 'ls', 280, false, 'prep', null, null, null, null, null, null),
  ('ti_pc_2', 'tmpl_porch', 2, 'Porch floor', 'Two coats on the boards.', 180, 'sf', 4.2, false, 'floor', 'Ready Seal', 'Ready Seal', 'Dark Walnut', 'Dark Walnut', 3, '3-year maintenance coat recommended.')
on conflict (id) do nothing;

update templates set name = 'Paint — interior', description = 'Prep, walls, ceilings, and trim for living spaces.' where id = 'tmpl_int_paint';
update templates set name = 'Paint — exterior', description = 'Body, trim, and door with named products.' where id = 'tmpl_ext_paint';
update templates set name = 'Roof', description = 'Tear-off, ice and water, architectural shingles.' where id = 'tmpl_roof';
update templates set name = 'Gutters', description = 'Seamless gutters with guards and downspouts.' where id = 'tmpl_gutter';
update templates set name = 'Decks', description = 'Wash, repair, and stain a wood deck.' where id = 'tmpl_deck';

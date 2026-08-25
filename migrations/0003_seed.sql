insert into companies (id, user_id, name, trade, phone, email)
values (
  'co_demo',
  'system-demo',
  'Northside Home Co.',
  'paint-and-exterior',
  '(770) 555-0142',
  'hello@northsidehome.example'
);

insert into templates (id, company_id, name, trade, description, cover_note) values
(
  'tmpl_int_paint',
  null,
  'Interior paint — main floor',
  'paint',
  'Prep, walls, ceilings, and trim for living spaces. Built to be edited per house.',
  'A quiet coat for the rooms you live in. Same system we used upstairs, written down so the next painter does not have to guess.'
),
(
  'tmpl_ext_paint',
  null,
  'Exterior paint — body, trim, door',
  'paint',
  'Full exterior repaint with named products and colors.',
  'The house already has a color. This keeps it, documents it, and puts a warranty on the film.'
),
(
  'tmpl_roof',
  null,
  'Architectural shingle reroof',
  'roofing',
  'Tear-off, ice and water, GAF Timberline HDZ assembly.',
  'A complete reroof with the products named, so the warranty lives with the address — not a PDF in a drawer.'
),
(
  'tmpl_gutter',
  null,
  'Gutter and guard replacement',
  'exterior',
  '6-inch aluminum gutters with leaf guards and new downspouts.',
  'Sized for this roof, with guards so the next storm is not a service call.'
),
(
  'tmpl_hvac',
  null,
  'Heat pump replacement',
  'hvac',
  'Remove and replace split system with a named heat pump package.',
  'Equipment, tonnage, and warranty written into the house file the day it is installed.'
),
(
  'tmpl_deck',
  null,
  'Deck restore and stain',
  'exterior',
  'Wash, brighten, repair, and stain a wood deck.',
  'The stain color and product stay with the house so the next coat matches.'
);

insert into template_items
  (id, template_id, sort_order, name, description, qty, unit, unit_price, optional, category, manufacturer, product_name, sku, color, warranty_years, warranty_terms)
values
  ('ti_ip_1', 'tmpl_int_paint', 1, 'Protect, mask, and move', 'Floors, hardware, and furniture. Dust control for a lived-in house.', 1, 'ls', 240, false, 'prep', null, null, null, null, null, null),
  ('ti_ip_2', 'tmpl_int_paint', 2, 'Living room walls', 'Two coats, cut and roll.', 1, 'room', 680, false, 'paint', 'Sherwin-Williams', 'Cashmere', 'SW 7029', 'Agreeable Gray', null, 'Lifetime washability of the film when applied per spec.'),
  ('ti_ip_3', 'tmpl_int_paint', 3, 'Dining room walls', 'Two coats, same color as living.', 1, 'room', 540, false, 'paint', 'Sherwin-Williams', 'Cashmere', 'SW 7029', 'Agreeable Gray', null, null),
  ('ti_ip_4', 'tmpl_int_paint', 4, 'Hall and stair', 'Walls and high work.', 1, 'ls', 420, false, 'paint', 'Sherwin-Williams', 'Cashmere', 'SW 7029', 'Agreeable Gray', null, null),
  ('ti_ip_5', 'tmpl_int_paint', 5, 'Ceilings', 'Flat white, living, dining, hall.', 1, 'ls', 360, false, 'paint', 'Sherwin-Williams', 'ProMar 200', null, 'Ceiling Bright White', null, null),
  ('ti_ip_6', 'tmpl_int_paint', 6, 'Interior trim enamel', 'Doors, casing, base. Satin.', 1, 'ls', 480, false, 'paint', 'Sherwin-Williams', 'Emerald Urethane', null, 'Extra White', 15, '15-year film warranty.'),
  ('ti_ip_7', 'tmpl_int_paint', 7, 'Kitchen cabinet enamel', 'Doors and frames, two coats, new pulls not included.', 1, 'ls', 1800, true, 'paint', 'Sherwin-Williams', 'Emerald Urethane', null, 'Agreeable Gray', 15, '15-year film warranty.'),

  ('ti_ep_1', 'tmpl_ext_paint', 1, 'Prep, scrape, caulk, prime', 'Failed film, open joints, spot prime.', 1, 'ls', 850, false, 'prep', null, null, null, null, null, null),
  ('ti_ep_2', 'tmpl_ext_paint', 2, 'Body — clapboard', 'Two coats, spray and back-brush.', 1, 'house', 2400, false, 'paint', 'Sherwin-Williams', 'Duration Exterior', 'SW 7008', 'Alabaster', 15, '15-year film warranty.'),
  ('ti_ep_3', 'tmpl_ext_paint', 3, 'Trim and fascia', 'Two coats, brush and roll.', 1, 'house', 780, false, 'paint', 'Sherwin-Williams', 'Duration Exterior', null, 'Extra White', 15, '15-year film warranty.'),
  ('ti_ep_4', 'tmpl_ext_paint', 4, 'Front door enamel', 'Sand, prime, two coats.', 1, 'ea', 220, false, 'paint', 'Sherwin-Williams', 'Emerald Urethane', 'SW 2801', 'Rookwood Red', 15, '15-year film warranty.'),
  ('ti_ep_5', 'tmpl_ext_paint', 5, 'Cleanup and walkthrough', 'Hardware, punch, final walk.', 1, 'ls', 180, false, 'closeout', null, null, null, null, null, null),

  ('ti_rf_1', 'tmpl_roof', 1, 'Tear-off and haul', 'One layer, dumpster, magnetic sweep.', 24, 'sq', 90, false, 'tearoff', null, null, null, null, null, null),
  ('ti_rf_2', 'tmpl_roof', 2, 'Ice and water shield', 'Eaves, valleys, penetrations.', 1, 'ls', 640, false, 'underlayment', 'CertainTeed', 'WinterGuard', null, null, 25, '25-year product warranty.'),
  ('ti_rf_3', 'tmpl_roof', 3, 'Synthetic underlayment', 'Full deck.', 24, 'sq', 20, false, 'underlayment', 'GAF', 'FeltBuster', null, null, null, null),
  ('ti_rf_4', 'tmpl_roof', 4, 'Architectural shingles', 'Full roof, including starter.', 24, 'sq', 300, false, 'shingle', 'GAF', 'Timberline HDZ', 'Charcoal', 'Charcoal', 50, '50-year limited warranty. Golden Pledge available.'),
  ('ti_rf_5', 'tmpl_roof', 5, 'Ridge cap and vent', 'Hip and ridge, intake as needed.', 1, 'ls', 520, false, 'vent', 'GAF', 'TimberTex / Cobra', null, 'Charcoal', 50, 'Covered with shingle warranty.'),
  ('ti_rf_6', 'tmpl_roof', 6, 'Flashings and boots', 'Drip edge, step, pipe boots.', 1, 'ls', 390, false, 'flashing', null, null, null, null, null, null),
  ('ti_rf_7', 'tmpl_roof', 7, 'Permit, dumpster, closeout', 'City permit and final photos.', 1, 'ls', 410, false, 'closeout', null, null, null, null, null, null),

  ('ti_gt_1', 'tmpl_gutter', 1, 'Remove existing gutters', 'Haul-off included.', 1, 'ls', 280, false, 'demo', null, null, null, null, null, null),
  ('ti_gt_2', 'tmpl_gutter', 2, '6-inch aluminum gutters', 'Seamless, color-matched to trim.', 140, 'lf', 12, false, 'gutter', 'LeafFilter', '6-inch aluminum', null, 'White', 25, '25-year finish warranty.'),
  ('ti_gt_3', 'tmpl_gutter', 3, 'Leaf guards', 'Micromesh, whole run.', 140, 'lf', 18, false, 'guard', 'LeafFilter', 'Micromesh', null, null, null, 'Limited lifetime clog-free warranty.'),
  ('ti_gt_4', 'tmpl_gutter', 4, 'Downspouts and splash', 'New leaders to grade.', 4, 'ea', 85, false, 'downspout', null, null, null, 'White', null, null),

  ('ti_hv_1', 'tmpl_hvac', 1, 'Remove existing equipment', 'Recover refrigerant to spec.', 1, 'ls', 650, false, 'demo', null, null, null, null, null, null),
  ('ti_hv_2', 'tmpl_hvac', 2, 'Heat pump condenser', '2.5 ton, 17 SEER2.', 1, 'ea', 4200, false, 'equipment', 'Carrier', 'Infinity 24', null, null, 10, '10-year parts when registered.'),
  ('ti_hv_3', 'tmpl_hvac', 3, 'Air handler and coil', 'Matched indoor unit.', 1, 'ea', 2800, false, 'equipment', 'Carrier', 'Infinity fan coil', null, null, 10, '10-year parts when registered.'),
  ('ti_hv_4', 'tmpl_hvac', 4, 'Line set, pad, electrical', 'New disconnect and whip.', 1, 'ls', 980, false, 'install', null, null, null, null, 1, 'One-year labor.'),
  ('ti_hv_5', 'tmpl_hvac', 5, 'Startup and load test', 'Manual J on file.', 1, 'ls', 240, false, 'closeout', null, null, null, null, null, null),

  ('ti_dk_1', 'tmpl_deck', 1, 'Wash and brighten', 'Sodium percarbonate wash, neutralize.', 1, 'ls', 320, false, 'prep', null, null, null, null, null, null),
  ('ti_dk_2', 'tmpl_deck', 2, 'Board repair', 'Replace failed decking as needed, up to 8 boards.', 1, 'allow', 240, false, 'repair', null, null, null, null, null, null),
  ('ti_dk_3', 'tmpl_deck', 3, 'Transparent stain', 'Two coats, brush and pad.', 320, 'sf', 3.4, false, 'stain', 'Ready Seal', 'Ready Seal', 'Dark Walnut', 'Dark Walnut', 3, '3-year maintenance coat recommended.'),
  ('ti_dk_4', 'tmpl_deck', 4, 'Rail touch-up', 'Same stain, pickets and cap.', 1, 'ls', 180, false, 'stain', 'Ready Seal', 'Ready Seal', 'Dark Walnut', 'Dark Walnut', null, null);

insert into properties (
  id, company_id, share_token, invite_token, invite_status,
  address_line, city, state, zip, homeowner_name, homeowner_email, homeowner_phone, notes
) values (
  'prop_maple',
  'co_demo',
  'maple-14',
  'maple-invite',
  'claimed',
  '142 Maple Street',
  'Marietta',
  'GA',
  '30064',
  'Margaret Hale',
  'margaret.hale@example.com',
  '(770) 555-0198',
  'Craftsman bungalow. Lived-in. HOA wants earth tones. Gate on the south side for dumpster.'
);

insert into property_facts (id, property_id, field_key, value, source) values
  ('pf_1', 'prop_maple', 'year_built', '1924', 'contractor'),
  ('pf_2', 'prop_maple', 'square_feet', '1840', 'homeowner'),
  ('pf_3', 'prop_maple', 'stories', '1.5', 'contractor'),
  ('pf_4', 'prop_maple', 'foundation_type', 'Brick pier crawlspace', 'contractor'),
  ('pf_5', 'prop_maple', 'occupancy', 'Primary residence', 'homeowner'),
  ('pf_6', 'prop_maple', 'roof_type', 'Architectural shingle', 'contractor'),
  ('pf_7', 'prop_maple', 'roof_year', '2019', 'contractor'),
  ('pf_8', 'prop_maple', 'siding_type', 'Wood clapboard', 'contractor'),
  ('pf_9', 'prop_maple', 'exterior_paint', 'SW 7008 Alabaster, Duration Exterior', 'contractor'),
  ('pf_10', 'prop_maple', 'exterior_trim_paint', 'SW Extra White, Duration Exterior', 'contractor'),
  ('pf_11', 'prop_maple', 'front_door_paint', 'SW 2801 Rookwood Red, Emerald Urethane', 'contractor'),
  ('pf_12', 'prop_maple', 'gutter_type', '6-inch white aluminum with LeafFilter micromesh', 'contractor'),
  ('pf_13', 'prop_maple', 'interior_paint_main', 'SW 7029 Agreeable Gray (upstairs hall)', 'homeowner'),
  ('pf_14', 'prop_maple', 'flooring_main', 'White oak, site-finished', 'homeowner'),
  ('pf_15', 'prop_maple', 'hoa_name', 'Maple Park Civic Association', 'homeowner'),
  ('pf_16', 'prop_maple', 'hoa_rules', 'Earth tones. 14-day notice before exterior color change.', 'homeowner');

insert into property_photos (id, property_id, src, caption, category, uploaded_by) values
  ('ph_1', 'prop_maple', '/houses/maple-front.jpg', 'South elevation, April 2026', 'exterior', 'contractor'),
  ('ph_2', 'prop_maple', '/houses/maple-door.jpg', 'Front door, Rookwood Red', 'product', 'contractor'),
  ('ph_3', 'prop_maple', '/houses/maple-siding.jpg', 'Body and trim after 2023 paint', 'product', 'contractor'),
  ('ph_4', 'prop_maple', '/houses/maple-roof.jpg', 'GAF Timberline HDZ Charcoal, 2019', 'roof', 'contractor'),
  ('ph_5', 'prop_maple', '/houses/maple-interior.jpg', 'Living room, ready for paint', 'interior', 'homeowner');

insert into jobs (id, company_id, property_id, proposal_id, title, summary, completed_at) values
  (
    'job_roof',
    'co_demo',
    'prop_maple',
    null,
    'Architectural shingle reroof',
    'Full tear-off. Ice and water in valleys and eaves. GAF Timberline HDZ in Charcoal. Ridge vent added on the long run.',
    '2019-05-18'
  ),
  (
    'job_paint',
    'co_demo',
    'prop_maple',
    null,
    'Exterior paint — body, trim, door',
    'Duration on clapboard and trim. Door in Emerald Urethane. Colors named so the next coat matches.',
    '2023-09-12'
  ),
  (
    'job_gutter',
    'co_demo',
    'prop_maple',
    null,
    'Gutter and guard replacement',
    'Seamless 6-inch aluminum, white, with micromesh guards. Downspouts to grade on four corners.',
    '2024-03-04'
  );

insert into job_specs
  (id, job_id, kind, label, value, location_note, manufacturer, product_name, warranty_years, warranty_terms, warranty_expires)
values
  ('js_r1', 'job_roof', 'product', 'Shingles', 'Timberline HDZ, Charcoal', 'Entire roof', 'GAF', 'Timberline HDZ', 50, '50-year limited warranty.', '2069-05-18'),
  ('js_r2', 'job_roof', 'product', 'Ice and water', 'WinterGuard at eaves and valleys', 'Eaves, valleys', 'CertainTeed', 'WinterGuard', 25, '25-year product warranty.', '2044-05-18'),
  ('js_r3', 'job_roof', 'measurement', 'Squares', '24 squares, one layer tear-off', null, null, null, null, null, null),
  ('js_p1', 'job_paint', 'paint_color', 'Body', 'SW 7008 Alabaster', 'Clapboard', 'Sherwin-Williams', 'Duration Exterior', 15, '15-year film warranty.', '2038-09-12'),
  ('js_p2', 'job_paint', 'paint_color', 'Trim', 'SW Extra White', 'Fascia, casing, columns', 'Sherwin-Williams', 'Duration Exterior', 15, '15-year film warranty.', '2038-09-12'),
  ('js_p3', 'job_paint', 'paint_color', 'Front door', 'SW 2801 Rookwood Red', 'Front door', 'Sherwin-Williams', 'Emerald Urethane', 15, '15-year film warranty.', '2038-09-12'),
  ('js_g1', 'job_gutter', 'product', 'Gutters', '6-inch seamless aluminum, white', 'Eaves', 'LeafFilter', '6-inch aluminum', 25, '25-year finish warranty.', '2049-03-04'),
  ('js_g2', 'job_gutter', 'product', 'Guards', 'Micromesh, full run', 'All gutters', 'LeafFilter', 'Micromesh', null, 'Limited lifetime clog-free warranty.', null);

insert into proposals (
  id, company_id, property_id, template_id, share_token, title, status, cover_note, sent_at
) values (
  'prop_maple_p1',
  'co_demo',
  'prop_maple',
  'tmpl_int_paint',
  'maple-paint-draft',
  'Interior paint — main floor',
  'revised',
  'Margaret — a first draft for the rooms you live in. Same Cashmere system we used on the upstairs hall. You can change colors, drop the cabinet line, and add photos of the rooms so we do not guess at the trim profile.',
  '2026-08-12 14:00:00-04'
);

insert into proposal_items
  (id, proposal_id, sort_order, name, description, qty, unit, unit_price, included, optional, category, manufacturer, product_name, sku, color, location_note, warranty_years, warranty_terms, homeowner_note)
values
  ('pi_1', 'prop_maple_p1', 1, 'Protect, mask, and move', 'Floors, hardware, and furniture. Dust control for a lived-in house.', 1, 'ls', 240, true, false, 'prep', null, null, null, null, null, null, null, null),
  ('pi_2', 'prop_maple_p1', 2, 'Living room walls', 'Two coats, cut and roll.', 1, 'room', 680, true, false, 'paint', 'Sherwin-Williams', 'Cashmere', 'SW 7029', 'Agreeable Gray', 'Living room', null, 'Lifetime washability of the film when applied per spec.', 'Yes — match the upstairs hall.'),
  ('pi_3', 'prop_maple_p1', 3, 'Dining room walls', 'Two coats, same color as living.', 1, 'room', 540, true, false, 'paint', 'Sherwin-Williams', 'Cashmere', 'SW 7029', 'Agreeable Gray', 'Dining', null, null, null),
  ('pi_4', 'prop_maple_p1', 4, 'Hall and stair', 'Walls and high work.', 1, 'ls', 420, true, false, 'paint', 'Sherwin-Williams', 'Cashmere', 'SW 7029', 'Agreeable Gray', 'Main hall', null, null, null),
  ('pi_5', 'prop_maple_p1', 5, 'Ceilings', 'Flat white, living, dining, hall.', 1, 'ls', 360, true, false, 'paint', 'Sherwin-Williams', 'ProMar 200', null, 'Ceiling Bright White', null, null, null, null),
  ('pi_6', 'prop_maple_p1', 6, 'Interior trim enamel', 'Doors, casing, base. Satin.', 1, 'ls', 480, true, false, 'paint', 'Sherwin-Williams', 'Emerald Urethane', null, 'Extra White', null, 15, '15-year film warranty.', 'Keep Extra White. Do not go brighter.'),
  ('pi_7', 'prop_maple_p1', 7, 'Kitchen cabinet enamel', 'Doors and frames, two coats, new pulls not included.', 1, 'ls', 1800, false, true, 'paint', 'Sherwin-Williams', 'Emerald Urethane', null, 'Agreeable Gray', 'Kitchen', 15, '15-year film warranty.', 'Skip cabinets this round.');

insert into proposal_messages (id, proposal_id, author_role, author_name, body, created_at) values
  ('pm_1', 'prop_maple_p1', 'contractor', 'Northside Home Co.', 'First draft for the main floor. Same system as the upstairs hall. Colors are named so they stay with the house.', '2026-08-12 14:05:00-04'),
  ('pm_2', 'prop_maple_p1', 'homeowner', 'Margaret Hale', 'Can we use the same Agreeable Gray as the upstairs hall? And please skip the kitchen cabinets for now — we will do those after Thanksgiving.', '2026-08-14 09:22:00-04');

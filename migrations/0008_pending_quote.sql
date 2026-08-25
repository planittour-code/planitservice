insert into property_facts (id, property_id, field_key, value, source)
values
  ('pf_24', 'prop_maple', 'window_count', '12', 'contractor'),
  ('pf_25', 'prop_maple', 'window_type', 'Wood divided-lite', 'contractor'),
  ('pf_26', 'prop_maple', 'window_year', '1998', 'homeowner')
on conflict (property_id, field_key) do nothing;

insert into company_members (id, company_id, email, role)
values ('mem_demo_sales', 'co_demo', 'sales@northsidehome.example', 'sales')
on conflict (company_id, email) do nothing;

insert into proposals (
  id, company_id, property_id, template_id, share_token, title, status, cover_note, sent_at, created_by
) values (
  'prop_maple_p2',
  'co_demo',
  'prop_maple',
  'tmpl_windows',
  'maple-windows-pending',
  'Window replacement — Marvin Essential',
  'pending',
  'Twelve openings on the south and west elevations. Sales picked Marvin Essential. The yard cost is not in the book yet, so this stays in the shop until you approve the number.',
  null,
  null
) on conflict (id) do nothing;

insert into proposal_items
  (id, proposal_id, sort_order, name, description, qty, unit, unit_price, unit_cost, included, optional, category, manufacturer, product_name, sku, color, warranty_years, warranty_terms)
values
  ('pi_w1', 'prop_maple_p2', 1, 'Remove and haul', 'Wood divided-lite, 1998. Openings covered same day.', 12, 'ea', 55, null, true, false, 'demo', null, null, null, null, null, null),
  ('pi_w2', 'prop_maple_p2', 2, 'Marvin Essential', 'Unit, flashing, and install. Low-E glass. Yard cost proposed — not yet in the book.', 12, 'ea', 672, 480, true, false, 'window', 'Marvin', 'Essential', null, null, 20, '20-year glass. 10-year hardware when registered.'),
  ('pi_w3', 'prop_maple_p2', 3, 'Interior casing and stool', 'New casing at each opening.', 12, 'ea', 95, null, true, false, 'trim', null, null, null, null, null, null)
on conflict (id) do nothing;

insert into proposal_messages (id, proposal_id, author_role, author_name, body)
values (
  'pm_w1',
  'prop_maple_p2',
  'contractor',
  'Sales',
  'Quoted Marvin Essential at $480 a unit from the yard. Cost is not in the book. Margaret should not see this until you approve the number.'
) on conflict (id) do nothing;

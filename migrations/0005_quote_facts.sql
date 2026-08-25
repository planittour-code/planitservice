insert into property_facts (id, property_id, field_key, value, source) values
  ('pf_17', 'prop_maple', 'room_count', '6', 'contractor'),
  ('pf_18', 'prop_maple', 'ceiling_height', '9', 'contractor'),
  ('pf_19', 'prop_maple', 'roof_squares', '24', 'contractor'),
  ('pf_20', 'prop_maple', 'roof_pitch', '6/12', 'contractor'),
  ('pf_21', 'prop_maple', 'gutter_lf', '140', 'contractor'),
  ('pf_22', 'prop_maple', 'downspout_count', '4', 'contractor'),
  ('pf_23', 'prop_maple', 'hvac_type', 'Gas furnace + A/C', 'homeowner')
on conflict (property_id, field_key) do nothing;

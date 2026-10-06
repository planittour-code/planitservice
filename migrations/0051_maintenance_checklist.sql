create table if not exists maintenance_removed (
  property_id text not null references properties(id) on delete cascade,
  title text not null,
  removed_at timestamptz not null default now(),
  primary key (property_id, title)
);

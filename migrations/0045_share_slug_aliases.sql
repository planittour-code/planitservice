-- Previous share-link spellings stay reachable after a name correction.
create table if not exists profile_slug_aliases (
  slug text primary key,
  user_id text not null references "user"(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists shop_slug_aliases (
  slug text primary key,
  company_id text not null references companies(id) on delete cascade,
  created_at timestamptz not null default now()
);

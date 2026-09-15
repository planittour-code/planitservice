create table if not exists user_profiles (
  user_id text primary key,
  slug text unique,
  display_name text,
  headline text,
  bio text,
  photo_src text,
  website text,
  instagram text,
  facebook text,
  x_url text,
  linkedin text,
  nextdoor text,
  youtube text,
  updated_at timestamptz not null default now()
);
create unique index if not exists user_profiles_slug_idx on user_profiles (slug) where slug is not null;

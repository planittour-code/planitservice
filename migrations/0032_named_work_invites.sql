-- Named-contractor work posted from a House File (Standard). Invited pool stays Pro.
create table if not exists file_work_invites (
  id text primary key,
  property_id text not null references properties(id) on delete cascade,
  invited_by_user_id text not null,
  shop_email text not null,
  shop_name text,
  title text not null,
  body text not null,
  share_token text not null unique,
  status text not null default 'open',
  created_at timestamptz not null default now()
);
create index if not exists file_work_invites_property_idx
  on file_work_invites (property_id, created_at desc);
create index if not exists file_work_invites_email_idx
  on file_work_invites (shop_email, status);

create table if not exists portfolio_members (
  id text primary key,
  portfolio_id text not null references portfolios(id) on delete cascade,
  user_id text,
  email text not null,
  role text not null default 'staff',
  created_at timestamptz not null default now(),
  unique (portfolio_id, email)
);
create index if not exists portfolio_members_user_idx on portfolio_members (user_id);
create index if not exists portfolio_members_email_idx on portfolio_members (email);

alter table portfolios add column if not exists extra_seats int not null default 0;

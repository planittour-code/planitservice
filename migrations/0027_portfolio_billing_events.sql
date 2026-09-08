create table if not exists portfolio_billing_events (
  session_id text primary key,
  portfolio_id text not null references portfolios(id) on delete cascade,
  kind text not null,
  quantity int not null default 1,
  created_at timestamptz not null default now()
);

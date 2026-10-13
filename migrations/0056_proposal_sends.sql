-- Snapshot of each estimate email, plus delivery / open / response events.
create table if not exists proposal_sends (
  id text primary key,
  proposal_id text not null references proposals(id) on delete cascade,
  to_email text not null,
  subject text not null,
  html text not null,
  body_text text not null,
  snapshot_json text not null default '{}',
  resend_id text,
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  opened_at timestamptz,
  bounced_at timestamptz
);

create index if not exists proposal_sends_proposal_idx
  on proposal_sends (proposal_id, created_at desc);

create index if not exists proposal_sends_resend_idx
  on proposal_sends (resend_id)
  where resend_id is not null;

create table if not exists proposal_events (
  id text primary key,
  proposal_id text not null references proposals(id) on delete cascade,
  send_id text references proposal_sends(id) on delete set null,
  kind text not null,
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists proposal_events_proposal_idx
  on proposal_events (proposal_id, created_at);

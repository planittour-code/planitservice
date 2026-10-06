alter table property_transfers add column if not exists confirm_token text;
alter table property_transfers add column if not exists confirm_code text;
alter table property_transfers add column if not exists confirm_expires_at timestamptz;
alter table property_transfers add column if not exists confirmed_at timestamptz;
alter table property_transfers add column if not exists from_email text;

create unique index if not exists property_transfers_confirm_token_idx
  on property_transfers (confirm_token)
  where confirm_token is not null;

update property_transfers
set confirmed_at = coalesce(confirmed_at, created_at)
where status = 'pending' and confirmed_at is null;

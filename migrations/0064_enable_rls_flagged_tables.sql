-- Enable RLS on the 17 public tables the Supabase linter flagged
-- (created after 0015_lock_supabase_api.sql, so they missed its loop).
--
-- The app never uses supabase-js or the anon/publishable key; every query
-- runs server-side as the DATABASE_URL role (postgres in prod), which owns
-- these tables and has BYPASSRLS. So: no policies (deny-all for anon and
-- authenticated via PostgREST), and NOT "force", so the owner keeps
-- bypassing RLS. Grants to anon/authenticated are also revoked; those
-- revokes are skipped where the roles don't exist (local PGLite).

do $$
declare
  t text;
  tables text[] := array[
    'work_kits', 'work_kit_items', 'portfolios', 'portfolio_properties',
    'portfolio_billing_events', 'portfolio_members', 'file_work_invites',
    'analytics_events', 'user_profiles', 'shop_billing_events',
    'profile_slug_aliases', 'shop_slug_aliases', 'shop_bookings',
    'maintenance_removed', 'proposal_sends', 'proposal_events',
    'property_warranties'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on table public.%I from anon', t);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('revoke all on table public.%I from authenticated', t);
    end if;
  end loop;
end $$;

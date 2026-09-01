-- Close the Supabase Data API.
--
-- This app never uses the anon/authenticated keys. It connects as the
-- database role in DATABASE_URL, which bypasses RLS. Enable RLS with no
-- policies so PostgREST cannot read or write. Also revoke grants so a
-- leaked anon key cannot SELECT account passwords or house records.
-- Role revokes are skipped when those roles do not exist (local PGLite).

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke usage on schema public from anon;
    revoke all on all tables in schema public from anon;
    revoke all on all sequences in schema public from anon;
    revoke all on all functions in schema public from anon;
    alter default privileges in schema public revoke all on tables from anon;
    alter default privileges in schema public revoke all on sequences from anon;
    alter default privileges in schema public revoke all on functions from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke usage on schema public from authenticated;
    revoke all on all tables in schema public from authenticated;
    revoke all on all sequences in schema public from authenticated;
    revoke all on all functions in schema public from authenticated;
    alter default privileges in schema public revoke all on tables from authenticated;
    alter default privileges in schema public revoke all on sequences from authenticated;
    alter default privileges in schema public revoke all on functions from authenticated;
  end if;
  revoke all on all tables in schema public from public;
  revoke all on all sequences in schema public from public;
  revoke all on all functions in schema public from public;
end $$;

do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename
    from pg_tables
    where schemaname = 'public'
  loop
    execute format('alter table %I.%I enable row level security', r.schemaname, r.tablename);
  end loop;
end $$;

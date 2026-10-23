-- Sprint 1 #1: tenant-scoped search index.
-- One row per searchable record (property / proposal / job). Work orders and
-- invoices join later. Every doc carries company_id + property_id; a shop only
-- ever queries `where company_id = <session company>`.
-- "People" are NOT a type: homeowner name/email/phone are indexed on the
-- property doc. Kept fresh by row triggers (same transaction as the write).

create extension if not exists pg_trgm;
create extension if not exists unaccent;

-- unaccent() is STABLE (depends on search_path), so it can't back an index.
-- Wrap it with an explicit, schema-qualified dictionary. Supabase may install
-- extensions into schema `extensions`, so resolve the schema at migration time.
do $$
declare
  ext_schema text;
begin
  select n.nspname into ext_schema
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where p.proname = 'unaccent' and p.pronargs = 2
  limit 1;
  if ext_schema is null then
    raise exception 'unaccent(regdictionary, text) not found';
  end if;
  execute format(
    'create or replace function public.f_unaccent(text) returns text
       language sql immutable parallel safe strict
       as $f$ select %1$I.unaccent(%2$L::regdictionary, $1) $f$',
    ext_schema, ext_schema || '.unaccent');
end
$$;

-- Normalizers shared by triggers and (later) the search API.
create or replace function public.search_norm(text) returns text
  language sql immutable parallel safe
  as $$ select lower(public.f_unaccent(coalesce($1, ''))) $$;

create or replace function public.search_phone_norm(text) returns text
  language sql immutable parallel safe
  as $$ select nullif(regexp_replace(coalesce($1, ''), '[^0-9]', '', 'g'), '') $$;

create table if not exists search_documents (
  doc_type text not null,            -- 'property' | 'proposal' | 'job'
  ref_id text not null,              -- id of the source row
  property_id text,
  company_id text,
  portfolio_id text,                 -- one linked portfolio (see SEARCH.md)
  title text,
  subtitle text,
  address_norm text,
  phone_norm text,
  email_norm text,
  tsv tsvector,
  updated_at timestamptz default now(),
  unique (doc_type, ref_id)
);

create index if not exists search_documents_tsv_idx
  on search_documents using gin (tsv);
create index if not exists search_documents_address_trgm_idx
  on search_documents using gin (address_norm gin_trgm_ops);
create index if not exists search_documents_title_trgm_idx
  on search_documents using gin ((public.search_norm(title)) gin_trgm_ops);
create index if not exists search_documents_company_idx
  on search_documents (company_id, doc_type, updated_at desc);
create index if not exists search_documents_property_idx
  on search_documents (property_id);
create index if not exists search_documents_phone_idx
  on search_documents (company_id, phone_norm) where phone_norm is not null;
create index if not exists search_documents_email_idx
  on search_documents (company_id, email_norm) where email_norm is not null;

-- ---- refresh functions (upsert one doc; delete when source row is gone) ----

create or replace function public.search_refresh_property(pid text) returns void
  language plpgsql as $$
declare
  r properties%rowtype;
  addr text;
begin
  select * into r from properties where id = pid;
  if not found then
    delete from search_documents where doc_type = 'property' and ref_id = pid;
    return;
  end if;
  addr := concat_ws(' ', r.address_line, r.city, r.state, r.zip);
  insert into search_documents as d (
    doc_type, ref_id, property_id, company_id, portfolio_id, title, subtitle,
    address_norm, phone_norm, email_norm, tsv, updated_at)
  values (
    'property', r.id, r.id, r.company_id,
    (select min(pp.portfolio_id) from portfolio_properties pp where pp.property_id = r.id),
    r.address_line,
    concat_ws(' · ', concat_ws(', ', r.city, r.state || ' ' || r.zip), r.homeowner_name),
    public.search_norm(addr),
    public.search_phone_norm(r.homeowner_phone),
    nullif(lower(btrim(coalesce(r.homeowner_email, ''))), ''),
    setweight(to_tsvector('simple', public.search_norm(r.id)), 'A')
      || setweight(to_tsvector('simple', public.search_norm(addr)), 'A')
      || setweight(to_tsvector('simple', public.search_norm(
           concat_ws(' ', r.homeowner_name, r.homeowner_email, r.homeowner_phone,
             public.search_phone_norm(r.homeowner_phone)))), 'B'),
    now())
  on conflict (doc_type, ref_id) do update set
    property_id = excluded.property_id, company_id = excluded.company_id,
    portfolio_id = excluded.portfolio_id, title = excluded.title,
    subtitle = excluded.subtitle, address_norm = excluded.address_norm,
    phone_norm = excluded.phone_norm, email_norm = excluded.email_norm,
    tsv = excluded.tsv, updated_at = excluded.updated_at;
end $$;

create or replace function public.search_refresh_proposal(prid text) returns void
  language plpgsql as $$
declare
  r proposals%rowtype;
  p properties%rowtype;
  items text;
  addr text;
begin
  select * into r from proposals where id = prid;
  if not found then
    delete from search_documents where doc_type = 'proposal' and ref_id = prid;
    return;
  end if;
  select * into p from properties where id = r.property_id;
  select string_agg(pi.name, ' ' order by pi.sort_order) into items
    from proposal_items pi where pi.proposal_id = r.id;
  addr := concat_ws(' ', p.address_line, p.city, p.state, p.zip);
  insert into search_documents as d (
    doc_type, ref_id, property_id, company_id, portfolio_id, title, subtitle,
    address_norm, phone_norm, email_norm, tsv, updated_at)
  values (
    'proposal', r.id, r.property_id, r.company_id,
    (select min(pp.portfolio_id) from portfolio_properties pp where pp.property_id = r.property_id),
    r.title,
    concat_ws(' · ', r.status, p.address_line),
    public.search_norm(addr), null, null,
    setweight(to_tsvector('simple', public.search_norm(r.id)), 'A')
      || setweight(to_tsvector('simple', public.search_norm(r.title)), 'B')
      || setweight(to_tsvector('simple', public.search_norm(items)), 'C'),
    now())
  on conflict (doc_type, ref_id) do update set
    property_id = excluded.property_id, company_id = excluded.company_id,
    portfolio_id = excluded.portfolio_id, title = excluded.title,
    subtitle = excluded.subtitle, address_norm = excluded.address_norm,
    tsv = excluded.tsv, updated_at = excluded.updated_at;
end $$;

create or replace function public.search_refresh_job(jid text) returns void
  language plpgsql as $$
declare
  r jobs%rowtype;
  p properties%rowtype;
  addr text;
begin
  select * into r from jobs where id = jid;
  if not found then
    delete from search_documents where doc_type = 'job' and ref_id = jid;
    return;
  end if;
  select * into p from properties where id = r.property_id;
  addr := concat_ws(' ', p.address_line, p.city, p.state, p.zip);
  insert into search_documents as d (
    doc_type, ref_id, property_id, company_id, portfolio_id, title, subtitle,
    address_norm, phone_norm, email_norm, tsv, updated_at)
  values (
    'job', r.id, r.property_id, r.company_id,
    (select min(pp.portfolio_id) from portfolio_properties pp where pp.property_id = r.property_id),
    r.title,
    concat_ws(' · ', r.completed_at::text, p.address_line),
    public.search_norm(addr), null, null,
    setweight(to_tsvector('simple', public.search_norm(r.title)), 'B')
      || setweight(to_tsvector('simple', public.search_norm(r.summary)), 'C'),
    now())
  on conflict (doc_type, ref_id) do update set
    property_id = excluded.property_id, company_id = excluded.company_id,
    portfolio_id = excluded.portfolio_id, title = excluded.title,
    subtitle = excluded.subtitle, address_norm = excluded.address_norm,
    tsv = excluded.tsv, updated_at = excluded.updated_at;
end $$;

-- ---- triggers ----

create or replace function public.search_trg_properties() returns trigger
  language plpgsql as $$
declare
  x record;
begin
  if tg_op = 'DELETE' then
    perform public.search_refresh_property(old.id);
    return old;
  end if;
  perform public.search_refresh_property(new.id);
  -- Child docs carry the property address; refresh them when it changes.
  if tg_op = 'UPDATE' and (new.address_line, new.city, new.state, new.zip)
       is distinct from (old.address_line, old.city, old.state, old.zip) then
    for x in select id from proposals where property_id = new.id loop
      perform public.search_refresh_proposal(x.id);
    end loop;
    for x in select id from jobs where property_id = new.id loop
      perform public.search_refresh_job(x.id);
    end loop;
  end if;
  return new;
end $$;

create or replace function public.search_trg_proposals() returns trigger
  language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    perform public.search_refresh_proposal(old.id);
    return old;
  end if;
  perform public.search_refresh_proposal(new.id);
  if tg_op = 'UPDATE' and new.id <> old.id then
    perform public.search_refresh_proposal(old.id);
  end if;
  return new;
end $$;

create or replace function public.search_trg_proposal_items() returns trigger
  language plpgsql as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.search_refresh_proposal(old.proposal_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and (tg_op = 'INSERT' or new.proposal_id <> old.proposal_id
       or new.name is distinct from old.name or new.sort_order is distinct from old.sort_order) then
    perform public.search_refresh_proposal(new.proposal_id);
  end if;
  return null;
end $$;

create or replace function public.search_trg_jobs() returns trigger
  language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    perform public.search_refresh_job(old.id);
    return old;
  end if;
  perform public.search_refresh_job(new.id);
  return new;
end $$;

create or replace function public.search_trg_portfolio_properties() returns trigger
  language plpgsql as $$
declare
  pid text := case when tg_op = 'DELETE' then old.property_id else new.property_id end;
begin
  update search_documents d
     set portfolio_id = (select min(pp.portfolio_id) from portfolio_properties pp
                         where pp.property_id = pid),
         updated_at = now()
   where d.property_id = pid;
  return null;
end $$;

drop trigger if exists search_properties_trg on properties;
create trigger search_properties_trg after insert or update or delete on properties
  for each row execute function public.search_trg_properties();
drop trigger if exists search_proposals_trg on proposals;
create trigger search_proposals_trg after insert or update or delete on proposals
  for each row execute function public.search_trg_proposals();
drop trigger if exists search_proposal_items_trg on proposal_items;
create trigger search_proposal_items_trg after insert or update or delete on proposal_items
  for each row execute function public.search_trg_proposal_items();
drop trigger if exists search_jobs_trg on jobs;
create trigger search_jobs_trg after insert or update or delete on jobs
  for each row execute function public.search_trg_jobs();
drop trigger if exists search_portfolio_properties_trg on portfolio_properties;
create trigger search_portfolio_properties_trg after insert or delete on portfolio_properties
  for each row execute function public.search_trg_portfolio_properties();

-- Backfill (AC 1.3: migration covers existing rows; idempotent upsert).
-- Re-runnable / resumable in batches outside deploy: `npm run search:backfill`.
select public.search_refresh_property(id) from properties;
select public.search_refresh_proposal(id) from proposals;
select public.search_refresh_job(id) from jobs;

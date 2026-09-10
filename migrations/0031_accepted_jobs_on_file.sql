-- One job line per File per accepted quote. Shop, owner, and PM rows at the
-- same address each get their own copy so /home and /manage show the work.
create unique index if not exists jobs_proposal_file_uidx
  on jobs (proposal_id, property_id)
  where proposal_id is not null;

insert into jobs (id, company_id, property_id, proposal_id, title, summary, completed_at)
select
  md5(dest.id || ':' || pr.id),
  pr.company_id,
  dest.id,
  pr.id,
  pr.title,
  coalesce(
    (
      select string_agg(pi.name, '. ' order by pi.sort_order)
      from (
        select name, sort_order
        from proposal_items
        where proposal_id = pr.id and included = true
        order by sort_order
        limit 4
      ) pi
    ),
    pr.title
  ),
  coalesce(pr.accepted_at::date, current_date)
from proposals pr
join properties src on src.id = pr.property_id
join properties dest
  on lower(trim(dest.address_line)) = lower(trim(src.address_line))
 and lower(trim(dest.zip)) = lower(trim(src.zip))
 and (
   dest.id = src.id
   or dest.company_id = 'co_household'
   or exists (select 1 from portfolio_properties pp where pp.property_id = dest.id)
 )
where pr.status in ('accepted', 'completed')
  and not exists (
    select 1 from jobs j where j.proposal_id = pr.id and j.property_id = dest.id
  );

insert into job_specs (
  id, job_id, kind, label, value, location_note, manufacturer, product_name,
  warranty_years, warranty_terms, warranty_expires
)
select
  md5(j.id || ':' || pi.id),
  j.id,
  case
    when pi.color is not null and btrim(pi.color) <> '' then 'paint_color'
    when pi.manufacturer is not null and btrim(pi.manufacturer) <> '' then 'product'
    else 'note'
  end,
  pi.name,
  coalesce(nullif(btrim(pi.color), ''), nullif(btrim(pi.product_name), ''), pi.name),
  pi.location_note,
  pi.manufacturer,
  pi.product_name,
  pi.warranty_years,
  pi.warranty_terms,
  case
    when pi.warranty_years is not null and pi.warranty_years > 0
      then (j.completed_at + make_interval(years => pi.warranty_years))::date
    else null
  end
from jobs j
join proposal_items pi on pi.proposal_id = j.proposal_id and pi.included = true
where j.proposal_id is not null
  and not exists (select 1 from job_specs s where s.job_id = j.id);

-- Porches is no longer its own billed category. Fold porch into deck.

update companies
set trades = (
  select string_agg(id, ',' order by ord)
  from (
    select min(ord) as ord, id
    from (
      select
        ordinality as ord,
        case
          when lower(btrim(token)) in ('porch', 'porches', 'decks') then 'deck'
          else btrim(token)
        end as id
      from unnest(string_to_array(coalesce(trades, ''), ',')) with ordinality as t(token, ordinality)
      where btrim(token) <> ''
    ) mapped
    group by id
  ) folded
)
where trades is not null
  and (
    trades ~* '(^|,)\s*porch\s*(,|$)'
    or trades ~* '(^|,)\s*porches\s*(,|$)'
    or trades ~* '(^|,)\s*decks\s*(,|$)'
  );

update companies
set trade_logos = (
  select case when count(*) = 0 then null else jsonb_object_agg(id, src)::text end
  from (
    select id, (array_agg(src))[1] as src
    from (
      select
        case
          when lower(key) in ('porch', 'porches', 'decks') then 'deck'
          else key
        end as id,
        value as src
      from jsonb_each_text(trade_logos::jsonb)
    ) mapped
    group by id
  ) folded
)
where trade_logos is not null
  and trade_logos ~* '"porch"|"porches"|"decks"';

update work_kits set work_id = 'deck' where lower(work_id) in ('porch', 'porches');
update rfps set work_id = 'deck' where lower(work_id) in ('porch', 'porches');
update quote_leads set work_id = 'deck' where lower(work_id) in ('porch', 'porches');

-- Backfill company_members.user_id from "user" by case-insensitive email.
-- Idempotent: only touches rows whose user_id is still null.
-- Skips: the household pseudo-company; emails matching more than one user
-- (ambiguous); and any (company, user) pair that is already linked through
-- another member row or would be claimed by two null rows at once, so a
-- (company_id, user_id) uniqueness rule can never be violated.
with unique_users as (
  select lower(email) as email_l, min(id) as user_id
  from "user"
  group by lower(email)
  having count(*) = 1
),
candidates as (
  select m.id as member_id, m.company_id, u.user_id
  from company_members m
  join unique_users u on u.email_l = lower(m.email)
  where m.user_id is null
    and m.company_id <> 'co_household'
),
safe as (
  select c.*
  from candidates c
  where not exists (
      select 1 from company_members o
      where o.company_id = c.company_id and o.user_id = c.user_id
    )
    and (select count(*) from candidates c2
         where c2.company_id = c.company_id and c2.user_id = c.user_id) = 1
)
update company_members m
set user_id = s.user_id
from safe s
where m.id = s.member_id
  and m.user_id is null;

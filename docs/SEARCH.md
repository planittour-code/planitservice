# Search index (Sprint 1 #1)

Migration `migrations/0058_search_documents.sql` adds `search_documents`: one row
per searchable record, kept fresh by row triggers in the same transaction as
the write (freshness is immediate, well under the 5s target).

| doc_type | source | indexed text |
|---|---|---|
| `property` | `properties` | id, address_line/city/state/zip (weight A), homeowner_name/email/phone (B) |
| `proposal` | `proposals` + `proposal_items` | id (A), title (B), item names (C) |
| `job` | `jobs` | title (B), summary (C) |

Work orders and invoices are added with Sprint 1 #4/#5. There is no Person type:
"people" hits are property docs matched on homeowner fields
(`phone_norm` = digits only, `email_norm` = lowercased).

**Tenancy.** Every doc carries `company_id` (copied from the source row) and
`property_id`. A shop's quote on an address it shares with another shop lives on
that shop's own `properties` row, so it gets its own doc under its own
`company_id`; there is never a cross-company doc. Every query MUST filter
`where company_id = <session company>` in SQL. `portfolio_id` holds one linked
portfolio (`min(portfolio_id)` from `portfolio_properties`) for convenience;
because a property can be in several portfolios, PM scoping should join
`portfolio_properties` rather than rely on this column.

Text config is `simple`; accents are folded by `public.f_unaccent()` (an
immutable wrapper that pins the unaccent dictionary to whatever schema the
extension lives in, e.g. `extensions` on Supabase). Use `public.search_norm(q)`
on query input.

## Before merge: prod extension check

Run against production (Supabase SQL editor):

```sql
select extname, extnamespace::regnamespace from pg_extension;
```

`pg_trgm` and `unaccent` must be available (installed or installable by the
migration role). If they live in `extensions`, that's fine: 0058 resolves the
schema at migration time.

## Backfill

0058 indexes all existing rows during the migration (idempotent upsert). To
re-index later (or after a failed/partial run), outside deploy:

```bash
DATABASE_URL=postgres://... npm run search:backfill
# resume a type from a given id:
DATABASE_URL=... npm run search:backfill -- --after-proposal=<last id logged>
```

It walks each table by primary key in batches of 1000, one short transaction
per batch, sleeping ~100 ms between batches. Re-running is safe. It is never run
by `npm run build` or `scripts/migrate.mjs`.

## Verify: no unindexed rows remain

```sql
select 'property' as type, count(*) from properties p
 where not exists (select 1 from search_documents d where d.doc_type = 'property' and d.ref_id = p.id)
union all
select 'proposal', count(*) from proposals p
 where not exists (select 1 from search_documents d where d.doc_type = 'proposal' and d.ref_id = p.id)
union all
select 'job', count(*) from jobs j
 where not exists (select 1 from search_documents d where d.doc_type = 'job' and d.ref_id = j.id);
```

All three counts must be 0.

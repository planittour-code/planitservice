-- Sprint 1 #2 search API: trigram indexes so partial phone ("123-4567") and
-- email-prefix queries are index-backed (the 0058 btree indexes only serve
-- exact matches). Lets the API OR every match arm into one bitmap scan.
create index if not exists search_documents_phone_trgm_idx
  on search_documents using gin (phone_norm gin_trgm_ops) where phone_norm is not null;
create index if not exists search_documents_email_trgm_idx
  on search_documents using gin (email_norm gin_trgm_ops) where email_norm is not null;
-- Exact-id lookups across types without knowing doc_type up front.
create index if not exists search_documents_ref_idx on search_documents (ref_id);

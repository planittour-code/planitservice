alter table proposals
  add column if not exists payment_link text,
  add column if not exists sales_emails text;

alter table public.document_uploads
  add column if not exists tax_year text not null default '2024',
  add column if not exists is_prior_year boolean not null default false;

create index if not exists idx_document_uploads_client_tax_year
  on public.document_uploads (client_id, tax_year, is_prior_year);
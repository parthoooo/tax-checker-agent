
-- 1. magic_link_tokens
create table if not exists public.magic_link_tokens (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  token      text unique not null default gen_random_uuid()::text,
  expires_at timestamptz not null default now() + interval '7 days',
  used_at    timestamptz,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.magic_link_tokens to authenticated;
grant select, insert on public.magic_link_tokens to anon;
grant all on public.magic_link_tokens to service_role;
alter table public.magic_link_tokens enable row level security;
drop policy if exists "admin all tokens" on public.magic_link_tokens;
create policy "admin all tokens" on public.magic_link_tokens for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "anon read token" on public.magic_link_tokens;
create policy "anon read token" on public.magic_link_tokens for select using (true);
drop policy if exists "authenticated read tokens" on public.magic_link_tokens;
create policy "authenticated read tokens" on public.magic_link_tokens for select to authenticated using (true);
drop policy if exists "authenticated insert tokens" on public.magic_link_tokens;
create policy "authenticated insert tokens" on public.magic_link_tokens for insert to authenticated with check (true);

-- 2. input_sheet_entries (from 002)
create table if not exists public.input_sheet_entries (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients(id) on delete cascade,
  tax_year     text not null default '2024',
  section      text not null,
  field_name   text not null,
  field_value  text,
  ai_populated boolean not null default false,
  verified     boolean not null default false,
  created_at   timestamptz not null default now()
);
grant select, insert, update, delete on public.input_sheet_entries to authenticated;
grant all on public.input_sheet_entries to service_role;
alter table public.input_sheet_entries enable row level security;
drop policy if exists "admin all entries" on public.input_sheet_entries;
create policy "admin all entries" on public.input_sheet_entries for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "demo read entries" on public.input_sheet_entries;
create policy "demo read entries" on public.input_sheet_entries for select to authenticated using (true);

-- 3. clients additions (idempotent)
alter table public.clients
  add column if not exists reminder_cadence_days int not null default 3,
  add column if not exists assigned_preparer text;

-- 4. Helper: token validity check (security definer)
create or replace function public.client_has_active_magic_token(_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.magic_link_tokens
    where client_id = _client_id
      and (expires_at is null or expires_at > now())
  );
$$;

-- 5. resolve_magic_link RPC for anon
drop function if exists public.resolve_magic_link(text);
drop function if exists public.resolve_magic_link(_token text);
drop function if exists public.resolve_magic_link(p_token text);
create or replace function public.resolve_magic_link(_token text)
returns table (
  client_id uuid,
  client_name text,
  client_email text,
  assigned_preparer text,
  token_id uuid,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.name, c.email, c.assigned_preparer, t.id, t.expires_at
  from public.magic_link_tokens t
  join public.clients c on c.id = t.client_id
  where t.token = _token
    and (t.expires_at is null or t.expires_at > now())
  limit 1;
$$;
grant execute on function public.resolve_magic_link(text) to anon, authenticated;

-- 6. Anon access via valid magic link token
-- clients: anon read clients that have an active token
grant select on public.clients to anon;
drop policy if exists "anon read clients via magic link" on public.clients;
create policy "anon read clients via magic link" on public.clients
  for select to anon
  using (public.client_has_active_magic_token(id));

-- document_requirements
grant select on public.document_requirements to anon;
drop policy if exists "anon read reqs via magic link" on public.document_requirements;
create policy "anon read reqs via magic link" on public.document_requirements
  for select to anon
  using (public.client_has_active_magic_token(client_id));

-- document_uploads
grant select, insert on public.document_uploads to anon;
drop policy if exists "anon read uploads via magic link" on public.document_uploads;
create policy "anon read uploads via magic link" on public.document_uploads
  for select to anon
  using (public.client_has_active_magic_token(client_id));
drop policy if exists "anon insert uploads via magic link" on public.document_uploads;
create policy "anon insert uploads via magic link" on public.document_uploads
  for insert to anon
  with check (public.client_has_active_magic_token(client_id));

-- ai_flags
grant insert on public.ai_flags to anon;
drop policy if exists "anon insert flags via magic link" on public.ai_flags;
create policy "anon insert flags via magic link" on public.ai_flags
  for insert to anon
  with check (public.client_has_active_magic_token(client_id));

-- email_drafts
grant insert on public.email_drafts to anon;
drop policy if exists "anon insert drafts via magic link" on public.email_drafts;
create policy "anon insert drafts via magic link" on public.email_drafts
  for insert to anon
  with check (public.client_has_active_magic_token(client_id));

-- activity_log
grant insert on public.activity_log to anon;
drop policy if exists "anon insert activity via magic link" on public.activity_log;
create policy "anon insert activity via magic link" on public.activity_log
  for insert to anon
  with check (public.client_has_active_magic_token(client_id));

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────
-- 1. clients
-- ─────────────────────────────────────────
create table if not exists public.clients (
  id                   uuid primary key default uuid_generate_v4(),
  name                 text not null,
  email                text unique not null,
  phone                text,
  documents_submitted  int  not null default 0,
  documents_required   int  not null default 4,
  status               text not null default 'active' check (status in ('active','overdue','complete')),
  issues               int  not null default 0,
  assigned_staff       text,
  last_activity        timestamptz not null default now(),
  auth_user_id         uuid references auth.users(id) on delete set null,
  created_at           timestamptz not null default now()
);

-- ─────────────────────────────────────────
-- 2. document_requirements
-- ─────────────────────────────────────────
create table if not exists public.document_requirements (
  id          uuid primary key default uuid_generate_v4(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  name        text not null,
  doc_type    text not null,
  tax_year    text not null default '2024',
  required    boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────
-- 3. document_uploads
-- ─────────────────────────────────────────
create table if not exists public.document_uploads (
  id              uuid primary key default uuid_generate_v4(),
  client_id       uuid not null references public.clients(id) on delete cascade,
  requirement_id  uuid references public.document_requirements(id) on delete set null,
  file_name       text not null,
  storage_path    text not null,
  file_size       bigint,
  mime_type       text,
  ai_status       text not null default 'pending' check (ai_status in ('pending','verified','flagged','rejected')),
  uploaded_by     uuid references auth.users(id) on delete set null,
  uploaded_at     timestamptz not null default now()
);

-- ─────────────────────────────────────────
-- 4. ai_flags
-- ─────────────────────────────────────────
create table if not exists public.ai_flags (
  id           uuid primary key default uuid_generate_v4(),
  client_id    uuid not null references public.clients(id) on delete cascade,
  upload_id    uuid references public.document_uploads(id) on delete set null,
  flag_type    text not null check (flag_type in ('wrong-year','duplicate','unexpected','missing')),
  severity     text not null default 'MEDIUM' check (severity in ('HIGH','MEDIUM','LOW')),
  description  text not null,
  detected_by  text not null default 'AI Agent',
  resolved     boolean not null default false,
  resolved_at  timestamptz,
  created_at   timestamptz not null default now()
);

-- ─────────────────────────────────────────
-- 5. activity_log
-- ─────────────────────────────────────────
create table if not exists public.activity_log (
  id          uuid primary key default uuid_generate_v4(),
  client_id   uuid references public.clients(id) on delete cascade,
  actor       text not null,
  actor_type  text not null check (actor_type in ('ai','staff','client')),
  action      text not null,
  meta        jsonb,
  created_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────
-- 6. reminders
-- ─────────────────────────────────────────
create table if not exists public.reminders (
  id           uuid primary key default uuid_generate_v4(),
  client_id    uuid not null references public.clients(id) on delete cascade,
  sent_by      uuid references auth.users(id) on delete set null,
  to_email     text not null,
  subject      text not null,
  body         text not null,
  sent_at      timestamptz not null default now()
);

-- ─────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────
alter table public.clients             enable row level security;
alter table public.document_requirements enable row level security;
alter table public.document_uploads    enable row level security;
alter table public.ai_flags            enable row level security;
alter table public.activity_log        enable row level security;
alter table public.reminders           enable row level security;

-- Helper: is the caller an admin (has a row in clients with no auth_user_id match or is nick@brodermansoor.com)?
-- Simpler approach: admins have email domain @brodermansoor.com
create or replace function public.is_admin()
returns boolean language sql security definer as $$
  select coalesce(
    (select raw_user_meta_data->>'role' = 'admin'
     from auth.users where id = auth.uid()),
    false
  );
$$;

-- clients: admins see all, clients see their own row
create policy "admin full access - clients" on public.clients
  for all using (public.is_admin());

create policy "client sees own row" on public.clients
  for select using (auth_user_id = auth.uid());

-- document_requirements: same pattern
create policy "admin full access - doc_req" on public.document_requirements
  for all using (public.is_admin());

create policy "client sees own req" on public.document_requirements
  for select using (
    client_id in (select id from public.clients where auth_user_id = auth.uid())
  );

-- document_uploads
create policy "admin full access - uploads" on public.document_uploads
  for all using (public.is_admin());

create policy "client sees own uploads" on public.document_uploads
  for select using (
    client_id in (select id from public.clients where auth_user_id = auth.uid())
  );

create policy "client can insert own uploads" on public.document_uploads
  for insert with check (
    client_id in (select id from public.clients where auth_user_id = auth.uid())
  );

-- ai_flags: admins only write; clients can read their own
create policy "admin full access - flags" on public.ai_flags
  for all using (public.is_admin());

create policy "client sees own flags" on public.ai_flags
  for select using (
    client_id in (select id from public.clients where auth_user_id = auth.uid())
  );

-- activity_log: admins see all; clients see their own
create policy "admin full access - activity" on public.activity_log
  for all using (public.is_admin());

create policy "client sees own activity" on public.activity_log
  for select using (
    client_id in (select id from public.clients where auth_user_id = auth.uid())
  );

-- reminders: admins only
create policy "admin full access - reminders" on public.reminders
  for all using (public.is_admin());

-- Hackathon bootstrap: run once in Supabase Dashboard → SQL Editor
-- Project: jhamklxdmxvlphimolbs
-- Generated from supabase/migrations/*

-- ── 001_initial.sql ──
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

-- ── 002_prototype_additions.sql ──

-- ── New tables for prototype features ────────────────────────────────

-- magic link tokens (passwordless client access)
create table if not exists public.magic_link_tokens (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  token      text unique not null default gen_random_uuid()::text,
  expires_at timestamptz not null default now() + interval '7 days',
  used_at    timestamptz,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.magic_link_tokens to authenticated;
grant all on public.magic_link_tokens to service_role;
alter table public.magic_link_tokens enable row level security;
create policy "admin all tokens" on public.magic_link_tokens for all using (public.is_admin()) with check (public.is_admin());
create policy "anon read token" on public.magic_link_tokens for select using (true);

-- email drafts queue
create table if not exists public.email_drafts (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  to_email    text not null,
  from_label  text not null default 'sj@brodermansoor.com',
  subject     text not null,
  body        text not null,
  status      text not null default 'pending' check (status in ('pending','approved','sent','dismissed')),
  approved_by text,
  approved_at timestamptz,
  created_at  timestamptz not null default now()
);
grant select, insert, update, delete on public.email_drafts to authenticated;
grant all on public.email_drafts to service_role;
alter table public.email_drafts enable row level security;
create policy "admin all drafts" on public.email_drafts for all using (public.is_admin()) with check (public.is_admin());
create policy "demo read drafts" on public.email_drafts for select to authenticated using (true);

-- input sheet entries
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
create policy "admin all entries" on public.input_sheet_entries for all using (public.is_admin()) with check (public.is_admin());
create policy "demo read entries" on public.input_sheet_entries for select to authenticated using (true);

-- time entries
create table if not exists public.time_entries (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references public.clients(id) on delete cascade,
  user_email       text not null,
  started_at       timestamptz not null default now(),
  ended_at         timestamptz,
  created_at       timestamptz not null default now()
);
grant select, insert, update, delete on public.time_entries to authenticated;
grant all on public.time_entries to service_role;
alter table public.time_entries enable row level security;
create policy "admin all time" on public.time_entries for all using (public.is_admin()) with check (public.is_admin());
create policy "demo read time" on public.time_entries for select to authenticated using (true);
create policy "authenticated insert time" on public.time_entries for insert to authenticated with check (true);
create policy "authenticated update own time" on public.time_entries for update to authenticated using (true);

-- ── Schema additions on existing tables ───────────────────────────────
alter table public.clients
  add column if not exists reminder_cadence_days int not null default 3,
  add column if not exists assigned_preparer text;

-- ── Preparer auth users ───────────────────────────────────────────────
do $$
declare
  v_shawn_id uuid;
  v_girik_id uuid;
begin
  -- Shawn (preparer)
  if not exists (select 1 from auth.users where email = 'shawn@brodermansoor.com') then
    v_shawn_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change,
      email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', v_shawn_id, 'authenticated', 'authenticated',
      'shawn@brodermansoor.com', crypt('password123', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"role":"preparer","full_name":"Sean Walsh"}'::jsonb,
      now(), now(), '', '', '', ''
    );
    insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_shawn_id,
      jsonb_build_object('sub', v_shawn_id::text, 'email', 'shawn@brodermansoor.com'),
      'email', v_shawn_id::text, now(), now(), now());
  end if;

  -- Girik (preparer)
  if not exists (select 1 from auth.users where email = 'girik@brodermansoor.com') then
    v_girik_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change,
      email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', v_girik_id, 'authenticated', 'authenticated',
      'girik@brodermansoor.com', crypt('password123', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"role":"preparer","full_name":"Girik Sharma"}'::jsonb,
      now(), now(), '', '', '', ''
    );
    insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_girik_id,
      jsonb_build_object('sub', v_girik_id::text, 'email', 'girik@brodermansoor.com'),
      'email', v_girik_id::text, now(), now(), now());
  end if;
end $$;

-- ── 20260528211056_5456194e-9a11-48d3-af65-767ed1bf6044.sql ──

-- ── Extensions ─────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- ── Tables ────────────────────────────────────────────────────────────
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique not null,
  phone text,
  documents_submitted int not null default 0,
  documents_required int not null default 4,
  status text not null default 'active' check (status in ('active','overdue','complete')),
  issues int not null default 0,
  assigned_staff text,
  last_activity timestamptz not null default now(),
  auth_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;

create table if not exists public.document_requirements (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  doc_type text not null,
  tax_year text not null default '2024',
  required boolean not null default true,
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_requirements TO authenticated;
GRANT ALL ON public.document_requirements TO service_role;

create table if not exists public.document_uploads (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  requirement_id uuid references public.document_requirements(id) on delete set null,
  file_name text not null,
  storage_path text not null,
  file_size bigint,
  mime_type text,
  ai_status text not null default 'pending' check (ai_status in ('pending','verified','flagged','rejected')),
  uploaded_by uuid references auth.users(id) on delete set null,
  uploaded_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_uploads TO authenticated;
GRANT ALL ON public.document_uploads TO service_role;

create table if not exists public.ai_flags (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  upload_id uuid references public.document_uploads(id) on delete set null,
  flag_type text not null check (flag_type in ('wrong-year','duplicate','unexpected','missing')),
  severity text not null default 'MEDIUM' check (severity in ('HIGH','MEDIUM','LOW')),
  description text not null,
  detected_by text not null default 'AI Agent',
  resolved boolean not null default false,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_flags TO authenticated;
GRANT ALL ON public.ai_flags TO service_role;

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  actor text not null,
  actor_type text not null check (actor_type in ('ai','staff','client')),
  action text not null,
  meta jsonb,
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_log TO authenticated;
GRANT ALL ON public.activity_log TO service_role;

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  sent_by uuid references auth.users(id) on delete set null,
  to_email text not null,
  subject text not null,
  body text not null,
  sent_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reminders TO authenticated;
GRANT ALL ON public.reminders TO service_role;

-- ── Admin helper (SECURITY DEFINER, avoids RLS recursion) ─────────────
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    (select raw_user_meta_data->>'role' = 'admin'
     from auth.users where id = auth.uid()),
    false
  );
$$;

-- ── RLS ───────────────────────────────────────────────────────────────
alter table public.clients enable row level security;
alter table public.document_requirements enable row level security;
alter table public.document_uploads enable row level security;
alter table public.ai_flags enable row level security;
alter table public.activity_log enable row level security;
alter table public.reminders enable row level security;

-- clients
create policy "admin all clients" on public.clients for all
  using (public.is_admin()) with check (public.is_admin());
create policy "client read own" on public.clients for select
  using (auth_user_id = auth.uid());

-- document_requirements
create policy "admin all reqs" on public.document_requirements for all
  using (public.is_admin()) with check (public.is_admin());
create policy "client read own reqs" on public.document_requirements for select
  using (client_id in (select id from public.clients where auth_user_id = auth.uid()));

-- document_uploads
create policy "admin all uploads" on public.document_uploads for all
  using (public.is_admin()) with check (public.is_admin());
create policy "client read own uploads" on public.document_uploads for select
  using (client_id in (select id from public.clients where auth_user_id = auth.uid()));
create policy "client insert own uploads" on public.document_uploads for insert
  with check (client_id in (select id from public.clients where auth_user_id = auth.uid()));

-- ai_flags
create policy "admin all flags" on public.ai_flags for all
  using (public.is_admin()) with check (public.is_admin());
create policy "client read own flags" on public.ai_flags for select
  using (client_id in (select id from public.clients where auth_user_id = auth.uid()));
create policy "client insert own flags" on public.ai_flags for insert
  with check (client_id in (select id from public.clients where auth_user_id = auth.uid()));

-- activity_log
create policy "admin all activity" on public.activity_log for all
  using (public.is_admin()) with check (public.is_admin());
create policy "client read own activity" on public.activity_log for select
  using (client_id in (select id from public.clients where auth_user_id = auth.uid()));
create policy "client insert own activity" on public.activity_log for insert
  with check (client_id in (select id from public.clients where auth_user_id = auth.uid()));

-- reminders
create policy "admin all reminders" on public.reminders for all
  using (public.is_admin()) with check (public.is_admin());
create policy "client insert own reminders" on public.reminders for insert
  with check (client_id in (select id from public.clients where auth_user_id = auth.uid()));
create policy "client read own reminders" on public.reminders for select
  using (client_id in (select id from public.clients where auth_user_id = auth.uid()));

-- ── Storage bucket ────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('documents','documents', false)
on conflict (id) do nothing;

create policy "admin all docs" on storage.objects for all
  using (bucket_id = 'documents' and public.is_admin())
  with check (bucket_id = 'documents' and public.is_admin());

create policy "client read own docs" on storage.objects for select
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = 'clients'
    and (storage.foldername(name))[2] in (
      select id::text from public.clients where auth_user_id = auth.uid()
    )
  );

create policy "client upload own docs" on storage.objects for insert
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = 'clients'
    and (storage.foldername(name))[2] in (
      select id::text from public.clients where auth_user_id = auth.uid()
    )
  );

-- ── Demo auth users ───────────────────────────────────────────────────
do $$
declare
  v_admin_id uuid;
  v_client_id uuid;
  v_john_client uuid := 'a1000000-0000-0000-0000-000000000001';
begin
  -- Nick (admin)
  if not exists (select 1 from auth.users where email = 'nick@brodermansoor.com') then
    v_admin_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change,
      email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', v_admin_id, 'authenticated','authenticated',
      'nick@brodermansoor.com', crypt('password123', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"role":"admin","full_name":"Nick Muqtadir"}'::jsonb,
      now(), now(), '', '', '', ''
    );
    insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_admin_id,
      jsonb_build_object('sub', v_admin_id::text, 'email','nick@brodermansoor.com'),
      'email', v_admin_id::text, now(), now(), now());
  end if;

  -- John Smith (client)
  if not exists (select 1 from auth.users where email = 'john.smith@email.com') then
    v_client_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change,
      email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', v_client_id, 'authenticated','authenticated',
      'john.smith@email.com', crypt('password123', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('role','client','full_name','John Smith','client_id', v_john_client::text),
      now(), now(), '', '', '', ''
    );
    insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_client_id,
      jsonb_build_object('sub', v_client_id::text, 'email','john.smith@email.com'),
      'email', v_client_id::text, now(), now(), now());
  end if;
end $$;

-- ── 20260528211115_11125ef4-abca-430e-94ab-3bc79382ff32.sql ──

revoke execute on function public.is_admin() from public, anon, authenticated;
grant execute on function public.is_admin() to service_role;

-- ── 20260529142556_87d6c3ec-8f01-495d-9f0d-26d2d2252fdc.sql ──

CREATE POLICY "demo authenticated read clients"        ON public.clients              FOR SELECT TO authenticated USING (true);
CREATE POLICY "demo authenticated read reqs"           ON public.document_requirements FOR SELECT TO authenticated USING (true);
CREATE POLICY "demo authenticated read uploads"        ON public.document_uploads     FOR SELECT TO authenticated USING (true);
CREATE POLICY "demo authenticated read flags"          ON public.ai_flags             FOR SELECT TO authenticated USING (true);
CREATE POLICY "demo authenticated read activity"       ON public.activity_log         FOR SELECT TO authenticated USING (true);
CREATE POLICY "demo authenticated read reminders"      ON public.reminders            FOR SELECT TO authenticated USING (true);

-- ── 20260531175219_584eff30-0d35-459b-9740-69bd86e529df.sql ──

-- email_drafts
CREATE TABLE public.email_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  to_email text NOT NULL,
  from_label text,
  subject text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_drafts TO authenticated;
GRANT ALL ON public.email_drafts TO service_role;

ALTER TABLE public.email_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin all email_drafts"
  ON public.email_drafts FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "demo authenticated read email_drafts"
  ON public.email_drafts FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "authenticated insert email_drafts"
  ON public.email_drafts FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated update email_drafts"
  ON public.email_drafts FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_email_drafts_status ON public.email_drafts(status);
CREATE INDEX idx_email_drafts_client ON public.email_drafts(client_id);

-- time_entries
CREATE TABLE public.time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  user_id uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_entries TO authenticated;
GRANT ALL ON public.time_entries TO service_role;

ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin all time_entries"
  ON public.time_entries FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "demo authenticated read time_entries"
  ON public.time_entries FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "user insert own time_entries"
  ON public.time_entries FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "user update own time_entries"
  ON public.time_entries FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL)
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE INDEX idx_time_entries_client ON public.time_entries(client_id);
CREATE INDEX idx_time_entries_started ON public.time_entries(started_at);

-- ── 20260531180818_b4d5bdbe-46d8-471a-b5ca-9db19fc9dc06.sql ──
ALTER TABLE public.email_drafts
  ADD CONSTRAINT email_drafts_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

ALTER TABLE public.time_entries
  ADD CONSTRAINT time_entries_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;
-- ── 20260602184114_677bf05c-2ced-4719-b831-cf30ab6be8d6.sql ──
-- Ensure authenticated users (admin/preparer demo accounts) can write to the
-- tables used by the demo data seeder. Matches the existing "demo authenticated
-- read" policies that already allow reads.

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_requirements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_uploads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_flags TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_log TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_drafts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reminders TO authenticated;

GRANT ALL ON public.clients TO service_role;
GRANT ALL ON public.document_requirements TO service_role;
GRANT ALL ON public.document_uploads TO service_role;
GRANT ALL ON public.ai_flags TO service_role;
GRANT ALL ON public.activity_log TO service_role;
GRANT ALL ON public.email_drafts TO service_role;
GRANT ALL ON public.time_entries TO service_role;
GRANT ALL ON public.reminders TO service_role;

-- Demo write policies for authenticated users (so the in-app "Load Demo Data"
-- button works for admin + preparer logins). These complement the existing
-- "demo authenticated read" SELECT policies and the admin-only ALL policies.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='clients' AND policyname='demo authenticated write clients') THEN
    EXECUTE 'CREATE POLICY "demo authenticated write clients" ON public.clients FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='document_requirements' AND policyname='demo authenticated write reqs') THEN
    EXECUTE 'CREATE POLICY "demo authenticated write reqs" ON public.document_requirements FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='document_uploads' AND policyname='demo authenticated write uploads') THEN
    EXECUTE 'CREATE POLICY "demo authenticated write uploads" ON public.document_uploads FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ai_flags' AND policyname='demo authenticated write flags') THEN
    EXECUTE 'CREATE POLICY "demo authenticated write flags" ON public.ai_flags FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='activity_log' AND policyname='demo authenticated write activity') THEN
    EXECUTE 'CREATE POLICY "demo authenticated write activity" ON public.activity_log FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='time_entries' AND policyname='demo authenticated write time_entries') THEN
    EXECUTE 'CREATE POLICY "demo authenticated write time_entries" ON public.time_entries FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='reminders' AND policyname='demo authenticated write reminders') THEN
    EXECUTE 'CREATE POLICY "demo authenticated write reminders" ON public.reminders FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;
END$$;

-- ── 20260616120000_document_uploads_tax_year.sql ──
-- Add tax_year and is_prior_year to document_uploads for YoY comparison
alter table public.document_uploads
  add column if not exists tax_year text not null default '2024',
  add column if not exists is_prior_year boolean not null default false;

create index if not exists idx_document_uploads_client_tax_year
  on public.document_uploads (client_id, tax_year, is_prior_year);

-- ── 20260616135639_1e570f45-bb59-45ed-a33b-9deaad978282.sql ──
alter table public.document_uploads
  add column if not exists tax_year text not null default '2024',
  add column if not exists is_prior_year boolean not null default false;

create index if not exists idx_document_uploads_client_tax_year
  on public.document_uploads (client_id, tax_year, is_prior_year);
-- ── 20260616140000_magic_link_public_access.sql ──
-- Magic link portal: public (anon) access via security-definer RPCs.
-- Fixes "Link Expired or Invalid" when token is valid but RLS blocks clients(*) join.

CREATE OR REPLACE FUNCTION public.resolve_magic_link(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_expires timestamptz;
  v_token_id uuid;
  v_reqs jsonb;
  v_uploads jsonb;
BEGIN
  SELECT t.client_id, t.expires_at, t.id
  INTO v_client_id, v_expires, v_token_id
  FROM magic_link_tokens t
  WHERE t.token = p_token;

  IF v_client_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_expires < now() THEN
    RETURN json_build_object('expired', true);
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.created_at), '[]'::jsonb)
  INTO v_reqs
  FROM document_requirements r
  WHERE r.client_id = v_client_id
    AND r.tax_year = '2025';

  IF v_reqs IS NULL OR v_reqs = '[]'::jsonb THEN
    SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.created_at), '[]'::jsonb)
    INTO v_reqs
    FROM document_requirements r
    WHERE r.client_id = v_client_id;
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(u) ORDER BY u.uploaded_at DESC), '[]'::jsonb)
  INTO v_uploads
  FROM document_uploads u
  WHERE u.client_id = v_client_id
    AND coalesce(u.is_prior_year, false) = false;

  RETURN json_build_object(
    'expired', false,
    'token_id', v_token_id,
    'token_expires_at', v_expires,
    'client', (SELECT row_to_json(c) FROM clients c WHERE c.id = v_client_id),
    'requirements', v_reqs,
    'uploads', v_uploads
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_magic_link(text) TO anon, authenticated;

-- Allow anon storage upload for clients with a valid (non-expired) magic link
CREATE OR REPLACE FUNCTION public.magic_link_allows_client(p_client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM magic_link_tokens t
    WHERE t.client_id = p_client_id
      AND t.expires_at > now()
  );
$$;

GRANT EXECUTE ON FUNCTION public.magic_link_allows_client(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "magic link storage upload" ON storage.objects;
CREATE POLICY "magic link storage upload" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = 'clients'
    AND public.magic_link_allows_client(((storage.foldername(name))[2])::uuid)
  );

DROP POLICY IF EXISTS "magic link insert upload row" ON public.document_uploads;
CREATE POLICY "magic link insert upload row" ON public.document_uploads
  FOR INSERT TO anon
  WITH CHECK (public.magic_link_allows_client(client_id));

DROP POLICY IF EXISTS "magic link update upload row" ON public.document_uploads;
CREATE POLICY "magic link update upload row" ON public.document_uploads
  FOR UPDATE TO anon
  USING (public.magic_link_allows_client(client_id))
  WITH CHECK (public.magic_link_allows_client(client_id));

DROP POLICY IF EXISTS "magic link insert flag" ON public.ai_flags;
CREATE POLICY "magic link insert flag" ON public.ai_flags
  FOR INSERT TO anon
  WITH CHECK (public.magic_link_allows_client(client_id));

DROP POLICY IF EXISTS "magic link insert email draft" ON public.email_drafts;
CREATE POLICY "magic link insert email draft" ON public.email_drafts
  FOR INSERT TO anon
  WITH CHECK (public.magic_link_allows_client(client_id));

DROP POLICY IF EXISTS "magic link insert activity" ON public.activity_log;
CREATE POLICY "magic link insert activity" ON public.activity_log
  FOR INSERT TO anon
  WITH CHECK (client_id IS NULL OR public.magic_link_allows_client(client_id));

GRANT INSERT ON public.document_uploads TO anon;
GRANT UPDATE ON public.document_uploads TO anon;
GRANT INSERT ON public.ai_flags TO anon;
GRANT INSERT ON public.email_drafts TO anon;
GRANT INSERT ON public.activity_log TO anon;

-- ── 20260616142332_a289a524-3d7b-41c2-9788-437e47ebe432.sql ──

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

-- ── 20260616150000_email_drafts_type.sql ──
-- Discriminator for Outbox vs Reminder workflows
ALTER TABLE public.email_drafts
  ADD COLUMN IF NOT EXISTS type text CHECK (type IS NULL OR type IN ('outbox', 'reminder'));

CREATE INDEX IF NOT EXISTS idx_email_drafts_type ON public.email_drafts(type);

-- ── 20260616151212_8a409ef7-bee6-4c15-b974-59f07d9009af.sql ──

-- 1) document_uploads tax year columns
ALTER TABLE public.document_uploads
  ADD COLUMN IF NOT EXISTS tax_year text NOT NULL DEFAULT '2024',
  ADD COLUMN IF NOT EXISTS is_prior_year boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_document_uploads_client_tax_year
  ON public.document_uploads (client_id, tax_year, is_prior_year);

-- 2) email_drafts.type
ALTER TABLE public.email_drafts
  ADD COLUMN IF NOT EXISTS type text CHECK (type IS NULL OR type IN ('outbox', 'reminder'));
CREATE INDEX IF NOT EXISTS idx_email_drafts_type ON public.email_drafts(type);

-- 3) Drop existing resolve_magic_link variants then recreate JSON version
DROP FUNCTION IF EXISTS public.resolve_magic_link(text);
DROP FUNCTION IF EXISTS public.resolve_magic_link(_token text);
DROP FUNCTION IF EXISTS public.resolve_magic_link(p_token text);

CREATE OR REPLACE FUNCTION public.resolve_magic_link(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_expires timestamptz;
  v_token_id uuid;
  v_reqs json;
  v_uploads json;
BEGIN
  SELECT t.client_id, t.expires_at, t.id
  INTO v_client_id, v_expires, v_token_id
  FROM magic_link_tokens t
  WHERE t.token = p_token;

  IF v_client_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_expires < now() THEN
    RETURN json_build_object('expired', true);
  END IF;

  SELECT coalesce(json_agg(r ORDER BY r.created_at), '[]'::json)
  INTO v_reqs
  FROM document_requirements r
  WHERE r.client_id = v_client_id
    AND r.tax_year = '2025';

  IF v_reqs = '[]'::json OR v_reqs IS NULL THEN
    SELECT coalesce(json_agg(r ORDER BY r.created_at), '[]'::json)
    INTO v_reqs
    FROM document_requirements r
    WHERE r.client_id = v_client_id;
  END IF;

  SELECT coalesce(json_agg(u ORDER BY u.uploaded_at DESC), '[]'::json)
  INTO v_uploads
  FROM document_uploads u
  WHERE u.client_id = v_client_id
    AND coalesce(u.is_prior_year, false) = false;

  RETURN json_build_object(
    'expired', false,
    'token_id', v_token_id,
    'token_expires_at', v_expires,
    'client', (SELECT row_to_json(c) FROM clients c WHERE c.id = v_client_id),
    'requirements', v_reqs,
    'uploads', v_uploads
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_magic_link(text) TO anon, authenticated;

-- 4) magic_link_allows_client helper + anon policies
CREATE OR REPLACE FUNCTION public.magic_link_allows_client(p_client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM magic_link_tokens t
    WHERE t.client_id = p_client_id
      AND t.expires_at > now()
  );
$$;

GRANT EXECUTE ON FUNCTION public.magic_link_allows_client(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "magic link storage upload" ON storage.objects;
CREATE POLICY "magic link storage upload" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = 'clients'
    AND public.magic_link_allows_client(((storage.foldername(name))[2])::uuid)
  );

DROP POLICY IF EXISTS "magic link insert upload row" ON public.document_uploads;
CREATE POLICY "magic link insert upload row" ON public.document_uploads
  FOR INSERT TO anon
  WITH CHECK (public.magic_link_allows_client(client_id));

DROP POLICY IF EXISTS "magic link update upload row" ON public.document_uploads;
CREATE POLICY "magic link update upload row" ON public.document_uploads
  FOR UPDATE TO anon
  USING (public.magic_link_allows_client(client_id))
  WITH CHECK (public.magic_link_allows_client(client_id));

DROP POLICY IF EXISTS "magic link insert flag" ON public.ai_flags;
CREATE POLICY "magic link insert flag" ON public.ai_flags
  FOR INSERT TO anon
  WITH CHECK (public.magic_link_allows_client(client_id));

DROP POLICY IF EXISTS "magic link insert email draft" ON public.email_drafts;
CREATE POLICY "magic link insert email draft" ON public.email_drafts
  FOR INSERT TO anon
  WITH CHECK (public.magic_link_allows_client(client_id));

DROP POLICY IF EXISTS "magic link insert activity" ON public.activity_log;
CREATE POLICY "magic link insert activity" ON public.activity_log
  FOR INSERT TO anon
  WITH CHECK (client_id IS NULL OR public.magic_link_allows_client(client_id));

GRANT INSERT ON public.document_uploads TO anon;
GRANT UPDATE ON public.document_uploads TO anon;
GRANT INSERT ON public.ai_flags TO anon;
GRANT INSERT ON public.email_drafts TO anon;
GRANT INSERT ON public.activity_log TO anon;

-- ── 20260616160000_fix_resolve_magic_link_json.sql ──
-- Fix: json type does not support = comparison in PostgreSQL (42883 operator does not exist: json = json)

CREATE OR REPLACE FUNCTION public.resolve_magic_link(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_expires timestamptz;
  v_token_id uuid;
  v_reqs jsonb;
  v_uploads jsonb;
BEGIN
  SELECT t.client_id, t.expires_at, t.id
  INTO v_client_id, v_expires, v_token_id
  FROM magic_link_tokens t
  WHERE t.token = p_token;

  IF v_client_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_expires < now() THEN
    RETURN json_build_object('expired', true);
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.created_at), '[]'::jsonb)
  INTO v_reqs
  FROM document_requirements r
  WHERE r.client_id = v_client_id
    AND r.tax_year = '2025';

  IF v_reqs IS NULL OR v_reqs = '[]'::jsonb THEN
    SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.created_at), '[]'::jsonb)
    INTO v_reqs
    FROM document_requirements r
    WHERE r.client_id = v_client_id;
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(u) ORDER BY u.uploaded_at DESC), '[]'::jsonb)
  INTO v_uploads
  FROM document_uploads u
  WHERE u.client_id = v_client_id
    AND coalesce(u.is_prior_year, false) = false;

  RETURN json_build_object(
    'expired', false,
    'token_id', v_token_id,
    'token_expires_at', v_expires,
    'client', (SELECT row_to_json(c) FROM clients c WHERE c.id = v_client_id),
    'requirements', v_reqs,
    'uploads', v_uploads
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_magic_link(text) TO anon, authenticated;

-- ── 20260616172255_d2432826-494f-46ce-8617-358eb8bb5c5f.sql ──
CREATE OR REPLACE FUNCTION public.resolve_magic_link(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_expires timestamptz;
  v_token_id uuid;
  v_reqs jsonb;
  v_uploads jsonb;
BEGIN
  SELECT t.client_id, t.expires_at, t.id
  INTO v_client_id, v_expires, v_token_id
  FROM magic_link_tokens t
  WHERE t.token = p_token;

  IF v_client_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_expires < now() THEN
    RETURN json_build_object('expired', true);
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.created_at), '[]'::jsonb)
  INTO v_reqs
  FROM document_requirements r
  WHERE r.client_id = v_client_id
    AND r.tax_year = '2025';

  IF v_reqs IS NULL OR v_reqs = '[]'::jsonb THEN
    SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.created_at), '[]'::jsonb)
    INTO v_reqs
    FROM document_requirements r
    WHERE r.client_id = v_client_id;
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(u) ORDER BY u.uploaded_at DESC), '[]'::jsonb)
  INTO v_uploads
  FROM document_uploads u
  WHERE u.client_id = v_client_id
    AND coalesce(u.is_prior_year, false) = false;

  RETURN json_build_object(
    'expired', false,
    'token_id', v_token_id,
    'token_expires_at', v_expires,
    'client', (SELECT row_to_json(c) FROM clients c WHERE c.id = v_client_id),
    'requirements', v_reqs,
    'uploads', v_uploads
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_magic_link(text) TO anon, authenticated;
-- ── 20260616183045_d0d3ae67-f0e8-4608-8133-fc0346133d81.sql ──
-- 20260617120000_signup_requests.sql
create table if not exists public.signup_requests (
  id              uuid primary key default gen_random_uuid(),
  auth_user_id    uuid not null unique,
  email           text not null,
  full_name       text not null,
  provider        text not null default 'email',
  status          text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  approved_role   text check (approved_role is null or approved_role in ('client', 'preparer', 'admin')),
  approved_by     uuid,
  approved_at     timestamptz,
  rejected_reason text,
  created_at      timestamptz not null default now()
);

create index if not exists idx_signup_requests_status on public.signup_requests (status, created_at desc);
create index if not exists idx_signup_requests_email on public.signup_requests (email);

grant select, insert, update on public.signup_requests to authenticated;
grant all on public.signup_requests to service_role;

alter table public.signup_requests enable row level security;

drop policy if exists "user read own signup request" on public.signup_requests;
create policy "user read own signup request" on public.signup_requests
  for select to authenticated
  using (auth_user_id = auth.uid());

drop policy if exists "user insert own signup request" on public.signup_requests;
create policy "user insert own signup request" on public.signup_requests
  for insert to authenticated
  with check (auth_user_id = auth.uid());

drop policy if exists "demo authenticated manage signup requests" on public.signup_requests;
create policy "demo authenticated manage signup requests" on public.signup_requests
  for all to authenticated
  using (true) with check (true);

-- 20260617130000_client_upload_update_rls.sql
DROP POLICY IF EXISTS "client update own uploads" ON public.document_uploads;
CREATE POLICY "client update own uploads" ON public.document_uploads
  FOR UPDATE TO authenticated
  USING (
    client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid())
  )
  WITH CHECK (
    client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "client update own docs" ON storage.objects;
CREATE POLICY "client update own docs" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = 'clients'
    AND (storage.foldername(name))[2] IN (
      SELECT id::text FROM public.clients WHERE auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = 'clients'
    AND (storage.foldername(name))[2] IN (
      SELECT id::text FROM public.clients WHERE auth_user_id = auth.uid()
    )
  );

GRANT UPDATE ON public.document_uploads TO authenticated;
-- ── 20260616185034_52767590-1187-480c-b98c-1041713997a0.sql ──
-- Client portal: allow authenticated clients to UPDATE their own clients row on submit-for-review.

DROP POLICY IF EXISTS "client update own submission" ON public.clients;
CREATE POLICY "client update own submission" ON public.clients
  FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

GRANT UPDATE ON public.clients TO authenticated;
-- ── 20260616185858_bfa4b6a2-3efa-4bf7-b6bd-c07bbfb6382e.sql ──
-- 1) activity_log: drop NULL client_id branch from anon insert policy
DROP POLICY IF EXISTS "magic link insert activity" ON public.activity_log;
CREATE POLICY "magic link insert activity" ON public.activity_log
  FOR INSERT TO anon
  WITH CHECK (client_id IS NOT NULL AND public.magic_link_allows_client(client_id));

-- 2) storage.objects: allow anon magic-link read on documents bucket scoped to client folder
DROP POLICY IF EXISTS "magic link storage read" ON storage.objects;
CREATE POLICY "magic link storage read" ON storage.objects
  FOR SELECT TO anon
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = 'clients'
    AND public.magic_link_allows_client(((storage.foldername(name))[2])::uuid)
  );
-- ── 20260616194752_3cccd977-d80e-4a05-90e9-523fc6d0d5c8.sql ──
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS business_type text NOT NULL DEFAULT 'freelancer'
    CHECK (business_type IN ('employee', 'freelancer', 'partnership'));

CREATE TABLE IF NOT EXISTS public.client_corrections (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  tax_year            text NOT NULL DEFAULT '2025',
  comparison_snapshot jsonb NOT NULL,
  staff_message       text,
  status              text NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent', 'resolved')),
  sent_by             text,
  sent_at             timestamptz NOT NULL DEFAULT now(),
  resolved_at         timestamptz
);

CREATE INDEX IF NOT EXISTS idx_client_corrections_client_status
  ON public.client_corrections (client_id, status, sent_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.client_corrections TO authenticated;
GRANT ALL ON public.client_corrections TO service_role;

ALTER TABLE public.client_corrections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client read own corrections" ON public.client_corrections;
CREATE POLICY "client read own corrections" ON public.client_corrections
  FOR SELECT TO authenticated
  USING (client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "demo authenticated manage corrections" ON public.client_corrections;
CREATE POLICY "demo authenticated manage corrections" ON public.client_corrections
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.submit_documents_via_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id   uuid;
  v_client      clients%ROWTYPE;
  v_verified    int;
  v_required    int;
BEGIN
  SELECT mlt.client_id INTO v_client_id
  FROM magic_link_tokens mlt
  WHERE mlt.token = p_token
    AND (mlt.expires_at IS NULL OR mlt.expires_at > now());

  IF v_client_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Invalid or expired upload link');
  END IF;

  SELECT * INTO v_client FROM clients WHERE id = v_client_id;

  SELECT
    COUNT(*) FILTER (WHERE u.ai_status = 'verified'),
    COUNT(*)
  INTO v_verified, v_required
  FROM document_requirements r
  LEFT JOIN document_uploads u
    ON u.requirement_id = r.id
   AND u.client_id = r.client_id
   AND u.tax_year = '2025'
   AND COALESCE(u.is_prior_year, false) = false
  WHERE r.client_id = v_client_id
    AND r.tax_year = '2025'
    AND r.required = true;

  IF v_required = 0 OR v_verified < v_required THEN
    RETURN jsonb_build_object(
      'error', 'All required documents must be verified before submitting',
      'verified', v_verified,
      'required', v_required
    );
  END IF;

  UPDATE clients
  SET status = 'complete',
      documents_submitted = v_verified,
      documents_required = v_required,
      issues = 0,
      last_activity = now()
  WHERE id = v_client_id;

  INSERT INTO activity_log (client_id, actor, actor_type, action)
  VALUES (
    v_client_id,
    v_client.name,
    'client',
    'Submitted all 2025 documents for preparer review (magic link)'
  );

  RETURN jsonb_build_object(
    'ok', true,
    'client_id', v_client_id,
    'client_name', v_client.name,
    'client_email', v_client.email,
    'verified', v_verified
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_documents_via_token(text) TO anon, authenticated;
-- ── 20260616210732_06241925-4264-404e-8c2b-ed0ddfb3fa3a.sql ──
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS profession_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS prior_year_upload_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS year_upload_unlocks text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.clients.profession_locked IS 'When true, client cannot change profession on portal without admin reset';
COMMENT ON COLUMN public.clients.prior_year_upload_enabled IS 'Admin enables client to select prior tax year on portal';
COMMENT ON COLUMN public.clients.year_upload_unlocks IS 'Tax years admin unlocked for client re-upload after initial submission';

UPDATE public.clients
SET profession_locked = true
WHERE id IN (SELECT DISTINCT client_id FROM public.document_requirements);

CREATE OR REPLACE FUNCTION public.submit_documents_via_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id   uuid;
  v_client      clients%ROWTYPE;
  v_uploaded    int;
  v_required    int;
BEGIN
  SELECT mlt.client_id INTO v_client_id
  FROM magic_link_tokens mlt
  WHERE mlt.token = p_token
    AND (mlt.expires_at IS NULL OR mlt.expires_at > now());

  IF v_client_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Invalid or expired upload link');
  END IF;

  SELECT * INTO v_client FROM clients WHERE id = v_client_id;

  SELECT
    COUNT(*) FILTER (WHERE u.id IS NOT NULL),
    COUNT(*)
  INTO v_uploaded, v_required
  FROM document_requirements r
  LEFT JOIN LATERAL (
    SELECT du.id
    FROM document_uploads du
    WHERE du.requirement_id = r.id
      AND du.client_id = r.client_id
      AND du.tax_year = '2025'
    ORDER BY du.uploaded_at DESC
    LIMIT 1
  ) u ON true
  WHERE r.client_id = v_client_id
    AND r.tax_year = '2025'
    AND r.required = true;

  IF v_required = 0 OR v_uploaded < v_required THEN
    RETURN jsonb_build_object(
      'error', 'Upload a file for every required document before submitting',
      'uploaded', v_uploaded,
      'required', v_required
    );
  END IF;

  UPDATE clients
  SET status = 'complete',
      documents_submitted = v_uploaded,
      documents_required = v_required,
      issues = 0,
      last_activity = now()
  WHERE id = v_client_id;

  INSERT INTO activity_log (client_id, actor, actor_type, action)
  VALUES (
    v_client_id,
    v_client.name,
    'client',
    'Submitted all 2025 documents for preparer review (magic link)'
  );

  RETURN jsonb_build_object(
    'ok', true,
    'client_id', v_client_id,
    'client_name', v_client.name,
    'client_email', v_client.email,
    'uploaded', v_uploaded
  );
END;
$$;
-- ── 20260616212139_3fbda54a-f4ac-4c44-b69f-f2e77ced6d7a.sql ──
-- Security hardening: staff-scoped authenticated RLS + magic-link token possession via RPCs.
-- Replaces Phase-1 demo USING (true) policies and client_id-only magic link checks.

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT COALESCE(
    (
      SELECT raw_user_meta_data->>'role' IN ('admin', 'preparer')
      FROM auth.users
      WHERE id = auth.uid()
    ),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.is_staff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;

CREATE OR REPLACE FUNCTION public._magic_link_client_id(p_token text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.client_id
  FROM public.magic_link_tokens t
  WHERE t.token = p_token
    AND (t.expires_at IS NULL OR t.expires_at > now())
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public._magic_link_client_id(text) FROM PUBLIC;

DROP POLICY IF EXISTS "demo authenticated read clients" ON public.clients;
DROP POLICY IF EXISTS "demo authenticated read reqs" ON public.document_requirements;
DROP POLICY IF EXISTS "demo authenticated read uploads" ON public.document_uploads;
DROP POLICY IF EXISTS "demo authenticated read flags" ON public.ai_flags;
DROP POLICY IF EXISTS "demo authenticated read activity" ON public.activity_log;
DROP POLICY IF EXISTS "demo authenticated read reminders" ON public.reminders;
DROP POLICY IF EXISTS "demo authenticated read email_drafts" ON public.email_drafts;
DROP POLICY IF EXISTS "demo authenticated read time_entries" ON public.time_entries;
DROP POLICY IF EXISTS "demo read drafts" ON public.email_drafts;
DROP POLICY IF EXISTS "demo read entries" ON public.input_sheet_entries;
DROP POLICY IF EXISTS "demo read time" ON public.time_entries;

DROP POLICY IF EXISTS "demo authenticated write clients" ON public.clients;
DROP POLICY IF EXISTS "demo authenticated write reqs" ON public.document_requirements;
DROP POLICY IF EXISTS "demo authenticated write uploads" ON public.document_uploads;
DROP POLICY IF EXISTS "demo authenticated write flags" ON public.ai_flags;
DROP POLICY IF EXISTS "demo authenticated write activity" ON public.activity_log;
DROP POLICY IF EXISTS "demo authenticated write time_entries" ON public.time_entries;
DROP POLICY IF EXISTS "demo authenticated write reminders" ON public.reminders;

DROP POLICY IF EXISTS "demo authenticated manage signup requests" ON public.signup_requests;
DROP POLICY IF EXISTS "demo authenticated manage corrections" ON public.client_corrections;

DROP POLICY IF EXISTS "authenticated insert email_drafts" ON public.email_drafts;
DROP POLICY IF EXISTS "authenticated update email_drafts" ON public.email_drafts;
DROP POLICY IF EXISTS "authenticated insert time" ON public.time_entries;
DROP POLICY IF EXISTS "authenticated update own time" ON public.time_entries;

DROP POLICY IF EXISTS "anon read clients via magic link" ON public.clients;
DROP POLICY IF EXISTS "anon read reqs via magic link" ON public.document_requirements;
DROP POLICY IF EXISTS "anon read uploads via magic link" ON public.document_uploads;
DROP POLICY IF EXISTS "anon insert uploads via magic link" ON public.document_uploads;
DROP POLICY IF EXISTS "anon insert flags via magic link" ON public.ai_flags;
DROP POLICY IF EXISTS "anon insert drafts via magic link" ON public.email_drafts;
DROP POLICY IF EXISTS "anon insert activity via magic link" ON public.activity_log;

DROP POLICY IF EXISTS "magic link insert upload row" ON public.document_uploads;
DROP POLICY IF EXISTS "magic link update upload row" ON public.document_uploads;
DROP POLICY IF EXISTS "magic link insert flag" ON public.ai_flags;
DROP POLICY IF EXISTS "magic link insert email draft" ON public.email_drafts;
DROP POLICY IF EXISTS "magic link insert activity" ON public.activity_log;
DROP POLICY IF EXISTS "magic link storage upload" ON storage.objects;
DROP POLICY IF EXISTS "magic link storage read" ON storage.objects;

DROP POLICY IF EXISTS "staff all clients" ON public.clients;
CREATE POLICY "staff all clients" ON public.clients
  FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "staff all reqs" ON public.document_requirements;
CREATE POLICY "staff all reqs" ON public.document_requirements
  FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "staff all uploads" ON public.document_uploads;
CREATE POLICY "staff all uploads" ON public.document_uploads
  FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "staff all flags" ON public.ai_flags;
CREATE POLICY "staff all flags" ON public.ai_flags
  FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "staff all activity" ON public.activity_log;
CREATE POLICY "staff all activity" ON public.activity_log
  FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "staff all reminders" ON public.reminders;
CREATE POLICY "staff all reminders" ON public.reminders
  FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "staff all email_drafts" ON public.email_drafts;
CREATE POLICY "staff all email_drafts" ON public.email_drafts
  FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "staff all time_entries" ON public.time_entries;
CREATE POLICY "staff all time_entries" ON public.time_entries
  FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "staff all input_sheet_entries" ON public.input_sheet_entries;
CREATE POLICY "staff all input_sheet_entries" ON public.input_sheet_entries
  FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "staff manage signup requests" ON public.signup_requests;
CREATE POLICY "staff manage signup requests" ON public.signup_requests
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "staff manage corrections" ON public.client_corrections;
CREATE POLICY "staff manage corrections" ON public.client_corrections
  FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "staff all storage docs" ON storage.objects;
CREATE POLICY "staff all storage docs" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'documents' AND public.is_staff())
  WITH CHECK (bucket_id = 'documents' AND public.is_staff());

REVOKE SELECT, INSERT, UPDATE, DELETE ON public.clients FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.document_requirements FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.document_uploads FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.ai_flags FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.email_drafts FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.activity_log FROM anon;

DROP FUNCTION IF EXISTS public.magic_link_allows_client(uuid);
DROP FUNCTION IF EXISTS public.client_has_active_magic_token(uuid);

CREATE OR REPLACE FUNCTION public.magic_link_upsert_upload(
  p_token text,
  p_existing_upload_id uuid,
  p_client_id uuid,
  p_requirement_id uuid,
  p_file_name text,
  p_storage_path text,
  p_file_size bigint,
  p_mime_type text,
  p_ai_status text,
  p_tax_year text DEFAULT '2025',
  p_is_prior_year boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_row public.document_uploads%ROWTYPE;
BEGIN
  v_client_id := public._magic_link_client_id(p_token);
  IF v_client_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Invalid or expired upload link');
  END IF;
  IF v_client_id IS DISTINCT FROM p_client_id THEN
    RETURN jsonb_build_object('error', 'Token does not match client');
  END IF;

  IF p_existing_upload_id IS NOT NULL THEN
    UPDATE public.document_uploads
    SET
      requirement_id = p_requirement_id,
      file_name = p_file_name,
      storage_path = p_storage_path,
      file_size = p_file_size,
      mime_type = p_mime_type,
      ai_status = p_ai_status,
      tax_year = p_tax_year,
      is_prior_year = p_is_prior_year,
      uploaded_at = now()
    WHERE id = p_existing_upload_id
      AND client_id = v_client_id
    RETURNING * INTO v_row;

    IF v_row.id IS NULL THEN
      RETURN jsonb_build_object('error', 'Upload not found for this client');
    END IF;
  ELSE
    INSERT INTO public.document_uploads (
      client_id, requirement_id, file_name, storage_path, file_size,
      mime_type, ai_status, tax_year, is_prior_year, uploaded_by
    ) VALUES (
      v_client_id, p_requirement_id, p_file_name, p_storage_path, p_file_size,
      p_mime_type, p_ai_status, p_tax_year, p_is_prior_year, NULL
    )
    RETURNING * INTO v_row;
  END IF;

  RETURN jsonb_build_object('ok', true, 'upload', to_jsonb(v_row));
END;
$$;

CREATE OR REPLACE FUNCTION public.magic_link_create_flag(
  p_token text,
  p_client_id uuid,
  p_upload_id uuid,
  p_flag_type text,
  p_severity text,
  p_description text,
  p_detected_by text DEFAULT 'Doc Classifier Agent'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_row public.ai_flags%ROWTYPE;
BEGIN
  v_client_id := public._magic_link_client_id(p_token);
  IF v_client_id IS NULL OR v_client_id IS DISTINCT FROM p_client_id THEN
    RETURN jsonb_build_object('error', 'Invalid or expired upload link');
  END IF;

  INSERT INTO public.ai_flags (
    client_id, upload_id, flag_type, severity, description, detected_by
  ) VALUES (
    v_client_id, p_upload_id, p_flag_type, p_severity, p_description, p_detected_by
  )
  RETURNING * INTO v_row;

  RETURN jsonb_build_object('ok', true, 'flag', to_jsonb(v_row));
END;
$$;

CREATE OR REPLACE FUNCTION public.magic_link_create_email_draft(
  p_token text,
  p_client_id uuid,
  p_to_email text,
  p_from_label text,
  p_subject text,
  p_body text,
  p_status text DEFAULT 'pending',
  p_type text DEFAULT 'outbox'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_row public.email_drafts%ROWTYPE;
BEGIN
  v_client_id := public._magic_link_client_id(p_token);
  IF v_client_id IS NULL OR v_client_id IS DISTINCT FROM p_client_id THEN
    RETURN jsonb_build_object('error', 'Invalid or expired upload link');
  END IF;

  INSERT INTO public.email_drafts (
    client_id, to_email, from_label, subject, body, status, type
  ) VALUES (
    v_client_id, p_to_email, p_from_label, p_subject, p_body, p_status, p_type
  )
  RETURNING * INTO v_row;

  RETURN jsonb_build_object('ok', true, 'draft', to_jsonb(v_row));
END;
$$;

CREATE OR REPLACE FUNCTION public.magic_link_log_activity(
  p_token text,
  p_client_id uuid,
  p_actor text,
  p_actor_type text,
  p_action text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
BEGIN
  v_client_id := public._magic_link_client_id(p_token);
  IF v_client_id IS NULL OR v_client_id IS DISTINCT FROM p_client_id THEN
    RETURN jsonb_build_object('error', 'Invalid or expired upload link');
  END IF;

  INSERT INTO public.activity_log (client_id, actor, actor_type, action)
  VALUES (v_client_id, p_actor, p_actor_type, p_action);

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.magic_link_upsert_upload(
  text, uuid, uuid, uuid, text, text, bigint, text, text, text, boolean
) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.magic_link_create_flag(
  text, uuid, uuid, text, text, text, text
) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.magic_link_create_email_draft(
  text, uuid, text, text, text, text, text, text
) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.magic_link_log_activity(
  text, uuid, text, text, text
) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.resolve_magic_link(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_expires timestamptz;
  v_token_id uuid;
  v_reqs jsonb;
  v_uploads jsonb;
  v_prior_reqs jsonb;
  v_prior_uploads jsonb;
BEGIN
  SELECT t.client_id, t.expires_at, t.id
  INTO v_client_id, v_expires, v_token_id
  FROM magic_link_tokens t
  WHERE t.token = p_token;

  IF v_client_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_expires IS NOT NULL AND v_expires < now() THEN
    RETURN json_build_object('expired', true);
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.created_at), '[]'::jsonb)
  INTO v_reqs
  FROM document_requirements r
  WHERE r.client_id = v_client_id AND r.tax_year = '2025';

  IF v_reqs IS NULL OR v_reqs = '[]'::jsonb THEN
    SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.created_at), '[]'::jsonb)
    INTO v_reqs
    FROM document_requirements r
    WHERE r.client_id = v_client_id;
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(u) ORDER BY u.uploaded_at DESC), '[]'::jsonb)
  INTO v_uploads
  FROM document_uploads u
  WHERE u.client_id = v_client_id
    AND u.tax_year = '2025'
    AND coalesce(u.is_prior_year, false) = false;

  SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.created_at), '[]'::jsonb)
  INTO v_prior_reqs
  FROM document_requirements r
  WHERE r.client_id = v_client_id AND r.tax_year = '2024';

  SELECT coalesce(jsonb_agg(to_jsonb(u) ORDER BY u.uploaded_at DESC), '[]'::jsonb)
  INTO v_prior_uploads
  FROM document_uploads u
  WHERE u.client_id = v_client_id AND u.tax_year = '2024';

  RETURN json_build_object(
    'expired', false,
    'token_id', v_token_id,
    'token_expires_at', v_expires,
    'client', (SELECT row_to_json(c) FROM clients c WHERE c.id = v_client_id),
    'requirements', v_reqs,
    'uploads', v_uploads,
    'prior_requirements', v_prior_reqs,
    'prior_uploads', v_prior_uploads
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_magic_link(text) TO anon, authenticated;

DROP POLICY IF EXISTS "anon read token" ON public.magic_link_tokens;
DROP POLICY IF EXISTS "authenticated read tokens" ON public.magic_link_tokens;
DROP POLICY IF EXISTS "authenticated insert tokens" ON public.magic_link_tokens;

DROP POLICY IF EXISTS "staff manage magic link tokens" ON public.magic_link_tokens;
CREATE POLICY "staff manage magic link tokens" ON public.magic_link_tokens
  FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

REVOKE SELECT, INSERT, UPDATE, DELETE ON public.magic_link_tokens FROM anon;

DROP POLICY IF EXISTS "client insert own email drafts" ON public.email_drafts;
CREATE POLICY "client insert own email drafts" ON public.email_drafts
  FOR INSERT TO authenticated
  WITH CHECK (
    client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "client read own email drafts" ON public.email_drafts;
CREATE POLICY "client read own email drafts" ON public.email_drafts
  FOR SELECT TO authenticated
  USING (
    client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid())
  );
-- ── 20260616235533_ab568d4e-e139-4c4f-a8eb-c26ba94b7b42.sql ──
-- Client portal checklist sync (SECURITY DEFINER).
CREATE OR REPLACE FUNCTION public._profession_template_rows(p_business_type text)
RETURNS TABLE(name text, doc_type text)
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT v.name, v.doc_type
  FROM (
    VALUES
      ('employee', 'W-2', 'w2'),
      ('employee', '1098 Mortgage Interest', '1098'),
      ('employee', '1099-INT', '1099-int'),
      ('freelancer', 'W-2', 'w2'),
      ('freelancer', '1099-NEC', '1099-nec'),
      ('freelancer', '1098 Mortgage Interest', '1098'),
      ('freelancer', 'Schedule C', 'sched-c'),
      ('partnership', 'W-2', 'w2'),
      ('partnership', '1099-NEC', '1099-nec'),
      ('partnership', '1098 Mortgage Interest', '1098'),
      ('partnership', 'Schedule C', 'sched-c'),
      ('partnership', 'K-1 Partnership', 'k1')
  ) AS v(business_type, name, doc_type)
  WHERE v.business_type = coalesce(nullif(p_business_type, ''), 'freelancer');
$$;

CREATE OR REPLACE FUNCTION public._portal_requirements_json(
  p_client_id uuid,
  p_tax_year text,
  p_business_type text
)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(
    jsonb_agg(to_jsonb(r) ORDER BY r.created_at),
    '[]'::jsonb
  )
  FROM public.document_requirements r
  WHERE r.client_id = p_client_id
    AND r.tax_year = p_tax_year
    AND r.required = true
    AND r.doc_type IN (
      SELECT t.doc_type FROM public._profession_template_rows(p_business_type) t
    );
$$;

CREATE OR REPLACE FUNCTION public._sync_checklist_to_profession(
  p_client_id uuid,
  p_tax_year text,
  p_business_type text,
  p_lock_profession boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_template record;
  v_req record;
  v_has_upload boolean;
  v_template_count integer;
  v_business_type text := coalesce(nullif(p_business_type, ''), 'freelancer');
BEGIN
  IF p_client_id IS NULL THEN
    RAISE EXCEPTION 'Client not found';
  END IF;

  SELECT count(*)::integer
  INTO v_template_count
  FROM public._profession_template_rows(v_business_type);

  FOR v_template IN
    SELECT t.name, t.doc_type
    FROM public._profession_template_rows(v_business_type) t
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM public.document_requirements r
      WHERE r.client_id = p_client_id
        AND r.tax_year = p_tax_year
        AND r.doc_type = v_template.doc_type
    ) THEN
      INSERT INTO public.document_requirements (
        client_id, name, doc_type, tax_year, required
      ) VALUES (
        p_client_id, v_template.name, v_template.doc_type, p_tax_year, true
      );
    END IF;
  END LOOP;

  FOR v_req IN
    SELECT *
    FROM public.document_requirements r
    WHERE r.client_id = p_client_id
      AND r.tax_year = p_tax_year
  LOOP
    IF EXISTS (
      SELECT 1
      FROM public._profession_template_rows(v_business_type) t
      WHERE t.doc_type = v_req.doc_type
    ) THEN
      IF NOT v_req.required THEN
        UPDATE public.document_requirements
        SET required = true
        WHERE id = v_req.id;
      END IF;
    ELSE
      SELECT EXISTS (
        SELECT 1
        FROM public.document_uploads u
        WHERE u.requirement_id = v_req.id
        LIMIT 1
      ) INTO v_has_upload;

      IF v_has_upload THEN
        IF v_req.required THEN
          UPDATE public.document_requirements
          SET required = false
          WHERE id = v_req.id;
        END IF;
      ELSE
        DELETE FROM public.document_requirements
        WHERE id = v_req.id;
      END IF;
    END IF;
  END LOOP;

  UPDATE public.clients
  SET business_type = v_business_type,
      documents_required = CASE
        WHEN p_tax_year = '2025' THEN v_template_count
        ELSE documents_required
      END,
      profession_locked = CASE
        WHEN p_lock_profession THEN true
        ELSE profession_locked
      END
  WHERE id = p_client_id;
END;
$$;

CREATE OR REPLACE FUNCTION public._client_id_for_auth_user()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.clients
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.client_ensure_portal_checklist(p_tax_year text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_business_type text;
BEGIN
  v_client_id := public._client_id_for_auth_user();
  IF v_client_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Client not found');
  END IF;

  SELECT coalesce(business_type, 'freelancer')
  INTO v_business_type
  FROM public.clients
  WHERE id = v_client_id;

  PERFORM public._sync_checklist_to_profession(
    v_client_id, p_tax_year, v_business_type, false
  );

  RETURN public._portal_requirements_json(v_client_id, p_tax_year, v_business_type);
END;
$$;

CREATE OR REPLACE FUNCTION public.client_update_profession(
  p_business_type text,
  p_lock_profession boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_locked boolean;
  v_prior_enabled boolean;
  v_business_type text := coalesce(nullif(p_business_type, ''), 'freelancer');
BEGIN
  v_client_id := public._client_id_for_auth_user();
  IF v_client_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Client not found');
  END IF;

  SELECT profession_locked, prior_year_upload_enabled
  INTO v_locked, v_prior_enabled
  FROM public.clients
  WHERE id = v_client_id;

  IF v_locked AND NOT p_lock_profession THEN
    RETURN jsonb_build_object('error', 'Profession is locked. Ask your preparer to unlock it on the portal.');
  END IF;

  PERFORM public._sync_checklist_to_profession(
    v_client_id, '2025', v_business_type, p_lock_profession
  );

  IF v_prior_enabled THEN
    PERFORM public._sync_checklist_to_profession(
      v_client_id, '2024', v_business_type, false
    );
  END IF;

  INSERT INTO public.activity_log (client_id, actor, actor_type, action)
  VALUES (
    v_client_id,
    'Client',
    'client',
    format('Set profession to %s and synced portal checklists', v_business_type)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'business_type', v_business_type,
    'requirements_2025', public._portal_requirements_json(v_client_id, '2025', v_business_type),
    'requirements_2024', CASE
      WHEN v_prior_enabled THEN public._portal_requirements_json(v_client_id, '2024', v_business_type)
      ELSE '[]'::jsonb
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.client_ensure_portal_checklist(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.client_update_profession(text, boolean) TO authenticated;

DROP POLICY IF EXISTS "client read own reqs" ON public.document_requirements;
CREATE POLICY "client read own reqs" ON public.document_requirements
  FOR SELECT TO authenticated
  USING (
    client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid())
  );
-- ── 20260617000510_b9435c0b-e7bb-4f50-9155-6e65bf4d466a.sql ──
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT COALESCE(
    (
      SELECT raw_app_meta_data->>'role' = 'admin'
      FROM auth.users
      WHERE id = auth.uid()
    ),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT COALESCE(
    (
      SELECT raw_app_meta_data->>'role' IN ('admin', 'preparer')
      FROM auth.users
      WHERE id = auth.uid()
    ),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_staff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated, service_role;

UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('role', raw_user_meta_data->>'role')
WHERE raw_user_meta_data->>'role' IN ('admin', 'preparer', 'client')
  AND COALESCE(raw_app_meta_data->>'role', '') = '';

UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data - 'role'
WHERE raw_user_meta_data ? 'role'
  AND COALESCE(raw_app_meta_data->>'role', '') <> '';

COMMENT ON FUNCTION public.is_admin IS 'True when auth.users.raw_app_meta_data.role = admin (not user_metadata).';
COMMENT ON FUNCTION public.is_staff IS 'True when auth.users.raw_app_meta_data.role is admin or preparer.';
-- ── 20260617120000_signup_requests.sql ──
-- Pending sign-up queue for Google OAuth + email registration (admin approval)

create table if not exists public.signup_requests (
  id              uuid primary key default gen_random_uuid(),
  auth_user_id    uuid not null unique,
  email           text not null,
  full_name       text not null,
  provider        text not null default 'email',
  status          text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  approved_role   text check (approved_role is null or approved_role in ('client', 'preparer', 'admin')),
  approved_by     uuid,
  approved_at     timestamptz,
  rejected_reason text,
  created_at      timestamptz not null default now()
);

create index if not exists idx_signup_requests_status on public.signup_requests (status, created_at desc);
create index if not exists idx_signup_requests_email on public.signup_requests (email);

grant select, insert, update on public.signup_requests to authenticated;
grant all on public.signup_requests to service_role;

alter table public.signup_requests enable row level security;

drop policy if exists "user read own signup request" on public.signup_requests;
create policy "user read own signup request" on public.signup_requests
  for select to authenticated
  using (auth_user_id = auth.uid());

drop policy if exists "user insert own signup request" on public.signup_requests;
create policy "user insert own signup request" on public.signup_requests
  for insert to authenticated
  with check (auth_user_id = auth.uid());

drop policy if exists "demo authenticated manage signup requests" on public.signup_requests;
create policy "demo authenticated manage signup requests" on public.signup_requests
  for all to authenticated
  using (true) with check (true);

-- ── 20260617130000_client_upload_update_rls.sql ──
-- Client portal: allow authenticated clients to UPDATE (replace) their own uploads and storage files.
-- Fixes "new row violates row-level security policy" on /portal Replace File.

DROP POLICY IF EXISTS "client update own uploads" ON public.document_uploads;
CREATE POLICY "client update own uploads" ON public.document_uploads
  FOR UPDATE TO authenticated
  USING (
    client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid())
  )
  WITH CHECK (
    client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "client update own docs" ON storage.objects;
CREATE POLICY "client update own docs" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = 'clients'
    AND (storage.foldername(name))[2] IN (
      SELECT id::text FROM public.clients WHERE auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = 'clients'
    AND (storage.foldername(name))[2] IN (
      SELECT id::text FROM public.clients WHERE auth_user_id = auth.uid()
    )
  );

GRANT UPDATE ON public.document_uploads TO authenticated;

-- ── 20260617140000_client_submit_update_rls.sql ──
-- Client portal: allow authenticated clients to UPDATE their own clients row on submit-for-review.

DROP POLICY IF EXISTS "client update own submission" ON public.clients;
CREATE POLICY "client update own submission" ON public.clients
  FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

GRANT UPDATE ON public.clients TO authenticated;

-- ── 20260617150000_business_type_client_corrections.sql ──
-- Profession-based clients + staff-sent correction checklists visible to clients

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS business_type text NOT NULL DEFAULT 'freelancer'
    CHECK (business_type IN ('employee', 'freelancer', 'partnership'));

CREATE TABLE IF NOT EXISTS public.client_corrections (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  tax_year            text NOT NULL DEFAULT '2025',
  comparison_snapshot jsonb NOT NULL,
  staff_message       text,
  status              text NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent', 'resolved')),
  sent_by             text,
  sent_at             timestamptz NOT NULL DEFAULT now(),
  resolved_at         timestamptz
);

CREATE INDEX IF NOT EXISTS idx_client_corrections_client_status
  ON public.client_corrections (client_id, status, sent_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.client_corrections TO authenticated;
GRANT ALL ON public.client_corrections TO service_role;

ALTER TABLE public.client_corrections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client read own corrections" ON public.client_corrections;
CREATE POLICY "client read own corrections" ON public.client_corrections
  FOR SELECT TO authenticated
  USING (client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "demo authenticated manage corrections" ON public.client_corrections;
CREATE POLICY "demo authenticated manage corrections" ON public.client_corrections
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Magic link: submit all verified docs without login (security definer)
CREATE OR REPLACE FUNCTION public.submit_documents_via_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id   uuid;
  v_client      clients%ROWTYPE;
  v_verified    int;
  v_required    int;
BEGIN
  SELECT mlt.client_id INTO v_client_id
  FROM magic_link_tokens mlt
  WHERE mlt.token = p_token
    AND (mlt.expires_at IS NULL OR mlt.expires_at > now());

  IF v_client_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Invalid or expired upload link');
  END IF;

  SELECT * INTO v_client FROM clients WHERE id = v_client_id;

  SELECT
    COUNT(*) FILTER (WHERE u.ai_status = 'verified'),
    COUNT(*)
  INTO v_verified, v_required
  FROM document_requirements r
  LEFT JOIN document_uploads u
    ON u.requirement_id = r.id
   AND u.client_id = r.client_id
   AND u.tax_year = '2025'
   AND COALESCE(u.is_prior_year, false) = false
  WHERE r.client_id = v_client_id
    AND r.tax_year = '2025'
    AND r.required = true;

  IF v_required = 0 OR v_verified < v_required THEN
    RETURN jsonb_build_object(
      'error', 'All required documents must be verified before submitting',
      'verified', v_verified,
      'required', v_required
    );
  END IF;

  UPDATE clients
  SET status = 'complete',
      documents_submitted = v_verified,
      documents_required = v_required,
      issues = 0,
      last_activity = now()
  WHERE id = v_client_id;

  INSERT INTO activity_log (client_id, actor, actor_type, action)
  VALUES (
    v_client_id,
    v_client.name,
    'client',
    'Submitted all 2025 documents for preparer review (magic link)'
  );

  RETURN jsonb_build_object(
    'ok', true,
    'client_id', v_client_id,
    'client_name', v_client.name,
    'client_email', v_client.email,
    'verified', v_verified
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_documents_via_token(text) TO anon, authenticated;

-- ── 20260617160000_v7_profession_year_portal.sql ──
-- v7: client profession lock, prior-year upload access, per-year re-upload unlocks

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS profession_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS prior_year_upload_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS year_upload_unlocks text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.clients.profession_locked IS 'When true, client cannot change profession on portal without admin reset';
COMMENT ON COLUMN public.clients.prior_year_upload_enabled IS 'Admin enables client to select prior tax year on portal';
COMMENT ON COLUMN public.clients.year_upload_unlocks IS 'Tax years admin unlocked for client re-upload after initial submission';

-- Existing clients with a checklist already chose their template (admin or default)
UPDATE public.clients
SET profession_locked = true
WHERE id IN (SELECT DISTINCT client_id FROM public.document_requirements);

-- Magic link submit: all required slots must have a file (verified or flagged)
CREATE OR REPLACE FUNCTION public.submit_documents_via_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id   uuid;
  v_client      clients%ROWTYPE;
  v_uploaded    int;
  v_required    int;
BEGIN
  SELECT mlt.client_id INTO v_client_id
  FROM magic_link_tokens mlt
  WHERE mlt.token = p_token
    AND (mlt.expires_at IS NULL OR mlt.expires_at > now());

  IF v_client_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Invalid or expired upload link');
  END IF;

  SELECT * INTO v_client FROM clients WHERE id = v_client_id;

  SELECT
    COUNT(*) FILTER (WHERE u.id IS NOT NULL),
    COUNT(*)
  INTO v_uploaded, v_required
  FROM document_requirements r
  LEFT JOIN LATERAL (
    SELECT du.id
    FROM document_uploads du
    WHERE du.requirement_id = r.id
      AND du.client_id = r.client_id
      AND du.tax_year = '2025'
    ORDER BY du.uploaded_at DESC
    LIMIT 1
  ) u ON true
  WHERE r.client_id = v_client_id
    AND r.tax_year = '2025'
    AND r.required = true;

  IF v_required = 0 OR v_uploaded < v_required THEN
    RETURN jsonb_build_object(
      'error', 'Upload a file for every required document before submitting',
      'uploaded', v_uploaded,
      'required', v_required
    );
  END IF;

  UPDATE clients
  SET status = 'complete',
      documents_submitted = v_uploaded,
      documents_required = v_required,
      issues = 0,
      last_activity = now()
  WHERE id = v_client_id;

  INSERT INTO activity_log (client_id, actor, actor_type, action)
  VALUES (
    v_client_id,
    v_client.name,
    'client',
    'Submitted all 2025 documents for preparer review (magic link)'
  );

  RETURN jsonb_build_object(
    'ok', true,
    'client_id', v_client_id,
    'client_name', v_client.name,
    'client_email', v_client.email,
    'uploaded', v_uploaded
  );
END;
$$;

-- ── 20260617170000_security_rls_magic_link.sql ──
-- Security hardening: staff-scoped authenticated RLS + magic-link token possession via RPCs.
-- Replaces Phase-1 demo USING (true) policies and client_id-only magic link checks.

-- ── Staff helper (admin + preparer) ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT COALESCE(
    (
      SELECT raw_user_meta_data->>'role' IN ('admin', 'preparer')
      FROM auth.users
      WHERE id = auth.uid()
    ),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.is_staff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;

-- Internal: resolve client_id from possessed token (not granted to callers directly)
CREATE OR REPLACE FUNCTION public._magic_link_client_id(p_token text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.client_id
  FROM public.magic_link_tokens t
  WHERE t.token = p_token
    AND (t.expires_at IS NULL OR t.expires_at > now())
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public._magic_link_client_id(text) FROM PUBLIC;

-- ── Drop broken demo + anon direct-access policies ───────────────────────────
DROP POLICY IF EXISTS "demo authenticated read clients" ON public.clients;
DROP POLICY IF EXISTS "demo authenticated read reqs" ON public.document_requirements;
DROP POLICY IF EXISTS "demo authenticated read uploads" ON public.document_uploads;
DROP POLICY IF EXISTS "demo authenticated read flags" ON public.ai_flags;
DROP POLICY IF EXISTS "demo authenticated read activity" ON public.activity_log;
DROP POLICY IF EXISTS "demo authenticated read reminders" ON public.reminders;
DROP POLICY IF EXISTS "demo authenticated read email_drafts" ON public.email_drafts;
DROP POLICY IF EXISTS "demo authenticated read time_entries" ON public.time_entries;
DROP POLICY IF EXISTS "demo read drafts" ON public.email_drafts;
DROP POLICY IF EXISTS "demo read entries" ON public.input_sheet_entries;
DROP POLICY IF EXISTS "demo read time" ON public.time_entries;

DROP POLICY IF EXISTS "demo authenticated write clients" ON public.clients;
DROP POLICY IF EXISTS "demo authenticated write reqs" ON public.document_requirements;
DROP POLICY IF EXISTS "demo authenticated write uploads" ON public.document_uploads;
DROP POLICY IF EXISTS "demo authenticated write flags" ON public.ai_flags;
DROP POLICY IF EXISTS "demo authenticated write activity" ON public.activity_log;
DROP POLICY IF EXISTS "demo authenticated write time_entries" ON public.time_entries;
DROP POLICY IF EXISTS "demo authenticated write reminders" ON public.reminders;

DROP POLICY IF EXISTS "demo authenticated manage signup requests" ON public.signup_requests;
DROP POLICY IF EXISTS "demo authenticated manage corrections" ON public.client_corrections;

DROP POLICY IF EXISTS "authenticated insert email_drafts" ON public.email_drafts;
DROP POLICY IF EXISTS "authenticated update email_drafts" ON public.email_drafts;
DROP POLICY IF EXISTS "authenticated insert time" ON public.time_entries;
DROP POLICY IF EXISTS "authenticated update own time" ON public.time_entries;

DROP POLICY IF EXISTS "anon read clients via magic link" ON public.clients;
DROP POLICY IF EXISTS "anon read reqs via magic link" ON public.document_requirements;
DROP POLICY IF EXISTS "anon read uploads via magic link" ON public.document_uploads;
DROP POLICY IF EXISTS "anon insert uploads via magic link" ON public.document_uploads;
DROP POLICY IF EXISTS "anon insert flags via magic link" ON public.ai_flags;
DROP POLICY IF EXISTS "anon insert drafts via magic link" ON public.email_drafts;
DROP POLICY IF EXISTS "anon insert activity via magic link" ON public.activity_log;

DROP POLICY IF EXISTS "magic link insert upload row" ON public.document_uploads;
DROP POLICY IF EXISTS "magic link update upload row" ON public.document_uploads;
DROP POLICY IF EXISTS "magic link insert flag" ON public.ai_flags;
DROP POLICY IF EXISTS "magic link insert email draft" ON public.email_drafts;
DROP POLICY IF EXISTS "magic link insert activity" ON public.activity_log;
DROP POLICY IF EXISTS "magic link storage upload" ON storage.objects;
DROP POLICY IF EXISTS "magic link storage read" ON storage.objects;

-- ── Staff policies (admin + preparer portal access) ─────────────────────────
DROP POLICY IF EXISTS "staff all clients" ON public.clients;
CREATE POLICY "staff all clients" ON public.clients
  FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "staff all reqs" ON public.document_requirements;
CREATE POLICY "staff all reqs" ON public.document_requirements
  FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "staff all uploads" ON public.document_uploads;
CREATE POLICY "staff all uploads" ON public.document_uploads
  FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "staff all flags" ON public.ai_flags;
CREATE POLICY "staff all flags" ON public.ai_flags
  FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "staff all activity" ON public.activity_log;
CREATE POLICY "staff all activity" ON public.activity_log
  FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "staff all reminders" ON public.reminders;
CREATE POLICY "staff all reminders" ON public.reminders
  FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "staff all email_drafts" ON public.email_drafts;
CREATE POLICY "staff all email_drafts" ON public.email_drafts
  FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "staff all time_entries" ON public.time_entries;
CREATE POLICY "staff all time_entries" ON public.time_entries
  FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "staff all input_sheet_entries" ON public.input_sheet_entries;
CREATE POLICY "staff all input_sheet_entries" ON public.input_sheet_entries
  FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "staff manage signup requests" ON public.signup_requests;
CREATE POLICY "staff manage signup requests" ON public.signup_requests
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "staff manage corrections" ON public.client_corrections;
CREATE POLICY "staff manage corrections" ON public.client_corrections
  FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "staff all storage docs" ON storage.objects;
CREATE POLICY "staff all storage docs" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'documents' AND public.is_staff())
  WITH CHECK (bucket_id = 'documents' AND public.is_staff());

-- Revoke direct anon table access (magic link uses SECURITY DEFINER RPCs only)
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.clients FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.document_requirements FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.document_uploads FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.ai_flags FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.email_drafts FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.activity_log FROM anon;

-- Drop legacy helpers that checked token existence without possession
DROP FUNCTION IF EXISTS public.magic_link_allows_client(uuid);
DROP FUNCTION IF EXISTS public.client_has_active_magic_token(uuid);

-- ── Magic link RPCs (token must match client on every write) ────────────────

CREATE OR REPLACE FUNCTION public.magic_link_upsert_upload(
  p_token text,
  p_existing_upload_id uuid,
  p_client_id uuid,
  p_requirement_id uuid,
  p_file_name text,
  p_storage_path text,
  p_file_size bigint,
  p_mime_type text,
  p_ai_status text,
  p_tax_year text DEFAULT '2025',
  p_is_prior_year boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_row public.document_uploads%ROWTYPE;
BEGIN
  v_client_id := public._magic_link_client_id(p_token);
  IF v_client_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Invalid or expired upload link');
  END IF;
  IF v_client_id IS DISTINCT FROM p_client_id THEN
    RETURN jsonb_build_object('error', 'Token does not match client');
  END IF;

  IF p_existing_upload_id IS NOT NULL THEN
    UPDATE public.document_uploads
    SET
      requirement_id = p_requirement_id,
      file_name = p_file_name,
      storage_path = p_storage_path,
      file_size = p_file_size,
      mime_type = p_mime_type,
      ai_status = p_ai_status,
      tax_year = p_tax_year,
      is_prior_year = p_is_prior_year,
      uploaded_at = now()
    WHERE id = p_existing_upload_id
      AND client_id = v_client_id
    RETURNING * INTO v_row;

    IF v_row.id IS NULL THEN
      RETURN jsonb_build_object('error', 'Upload not found for this client');
    END IF;
  ELSE
    INSERT INTO public.document_uploads (
      client_id, requirement_id, file_name, storage_path, file_size,
      mime_type, ai_status, tax_year, is_prior_year, uploaded_by
    ) VALUES (
      v_client_id, p_requirement_id, p_file_name, p_storage_path, p_file_size,
      p_mime_type, p_ai_status, p_tax_year, p_is_prior_year, NULL
    )
    RETURNING * INTO v_row;
  END IF;

  RETURN jsonb_build_object('ok', true, 'upload', to_jsonb(v_row));
END;
$$;

CREATE OR REPLACE FUNCTION public.magic_link_create_flag(
  p_token text,
  p_client_id uuid,
  p_upload_id uuid,
  p_flag_type text,
  p_severity text,
  p_description text,
  p_detected_by text DEFAULT 'Doc Classifier Agent'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_row public.ai_flags%ROWTYPE;
BEGIN
  v_client_id := public._magic_link_client_id(p_token);
  IF v_client_id IS NULL OR v_client_id IS DISTINCT FROM p_client_id THEN
    RETURN jsonb_build_object('error', 'Invalid or expired upload link');
  END IF;

  INSERT INTO public.ai_flags (
    client_id, upload_id, flag_type, severity, description, detected_by
  ) VALUES (
    v_client_id, p_upload_id, p_flag_type, p_severity, p_description, p_detected_by
  )
  RETURNING * INTO v_row;

  RETURN jsonb_build_object('ok', true, 'flag', to_jsonb(v_row));
END;
$$;

CREATE OR REPLACE FUNCTION public.magic_link_create_email_draft(
  p_token text,
  p_client_id uuid,
  p_to_email text,
  p_from_label text,
  p_subject text,
  p_body text,
  p_status text DEFAULT 'pending',
  p_type text DEFAULT 'outbox'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_row public.email_drafts%ROWTYPE;
BEGIN
  v_client_id := public._magic_link_client_id(p_token);
  IF v_client_id IS NULL OR v_client_id IS DISTINCT FROM p_client_id THEN
    RETURN jsonb_build_object('error', 'Invalid or expired upload link');
  END IF;

  INSERT INTO public.email_drafts (
    client_id, to_email, from_label, subject, body, status, type
  ) VALUES (
    v_client_id, p_to_email, p_from_label, p_subject, p_body, p_status, p_type
  )
  RETURNING * INTO v_row;

  RETURN jsonb_build_object('ok', true, 'draft', to_jsonb(v_row));
END;
$$;

CREATE OR REPLACE FUNCTION public.magic_link_log_activity(
  p_token text,
  p_client_id uuid,
  p_actor text,
  p_actor_type text,
  p_action text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
BEGIN
  v_client_id := public._magic_link_client_id(p_token);
  IF v_client_id IS NULL OR v_client_id IS DISTINCT FROM p_client_id THEN
    RETURN jsonb_build_object('error', 'Invalid or expired upload link');
  END IF;

  INSERT INTO public.activity_log (client_id, actor, actor_type, action)
  VALUES (v_client_id, p_actor, p_actor_type, p_action);

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.magic_link_upsert_upload(
  text, uuid, uuid, uuid, text, text, bigint, text, text, text, boolean
) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.magic_link_create_flag(
  text, uuid, uuid, text, text, text, text
) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.magic_link_create_email_draft(
  text, uuid, text, text, text, text, text, text
) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.magic_link_log_activity(
  text, uuid, text, text, text
) TO anon, authenticated;

-- Extend resolve_magic_link with prior-year data for YoY analysis (no anon table reads)
CREATE OR REPLACE FUNCTION public.resolve_magic_link(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_expires timestamptz;
  v_token_id uuid;
  v_reqs jsonb;
  v_uploads jsonb;
  v_prior_reqs jsonb;
  v_prior_uploads jsonb;
BEGIN
  SELECT t.client_id, t.expires_at, t.id
  INTO v_client_id, v_expires, v_token_id
  FROM magic_link_tokens t
  WHERE t.token = p_token;

  IF v_client_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_expires IS NOT NULL AND v_expires < now() THEN
    RETURN json_build_object('expired', true);
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.created_at), '[]'::jsonb)
  INTO v_reqs
  FROM document_requirements r
  WHERE r.client_id = v_client_id AND r.tax_year = '2025';

  IF v_reqs IS NULL OR v_reqs = '[]'::jsonb THEN
    SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.created_at), '[]'::jsonb)
    INTO v_reqs
    FROM document_requirements r
    WHERE r.client_id = v_client_id;
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(u) ORDER BY u.uploaded_at DESC), '[]'::jsonb)
  INTO v_uploads
  FROM document_uploads u
  WHERE u.client_id = v_client_id
    AND u.tax_year = '2025'
    AND coalesce(u.is_prior_year, false) = false;

  SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.created_at), '[]'::jsonb)
  INTO v_prior_reqs
  FROM document_requirements r
  WHERE r.client_id = v_client_id AND r.tax_year = '2024';

  SELECT coalesce(jsonb_agg(to_jsonb(u) ORDER BY u.uploaded_at DESC), '[]'::jsonb)
  INTO v_prior_uploads
  FROM document_uploads u
  WHERE u.client_id = v_client_id AND u.tax_year = '2024';

  RETURN json_build_object(
    'expired', false,
    'token_id', v_token_id,
    'token_expires_at', v_expires,
    'client', (SELECT row_to_json(c) FROM clients c WHERE c.id = v_client_id),
    'requirements', v_reqs,
    'uploads', v_uploads,
    'prior_requirements', v_prior_reqs,
    'prior_uploads', v_prior_uploads
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_magic_link(text) TO anon, authenticated;

-- Magic link tokens: staff/admin only (no public token enumeration)
DROP POLICY IF EXISTS "anon read token" ON public.magic_link_tokens;
DROP POLICY IF EXISTS "authenticated read tokens" ON public.magic_link_tokens;
DROP POLICY IF EXISTS "authenticated insert tokens" ON public.magic_link_tokens;

DROP POLICY IF EXISTS "staff manage magic link tokens" ON public.magic_link_tokens;
CREATE POLICY "staff manage magic link tokens" ON public.magic_link_tokens
  FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

REVOKE SELECT, INSERT, UPDATE, DELETE ON public.magic_link_tokens FROM anon;

-- Client portal: own-row email draft insert (AI analysis follow-up)
DROP POLICY IF EXISTS "client insert own email drafts" ON public.email_drafts;
CREATE POLICY "client insert own email drafts" ON public.email_drafts
  FOR INSERT TO authenticated
  WITH CHECK (
    client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "client read own email drafts" ON public.email_drafts;
CREATE POLICY "client read own email drafts" ON public.email_drafts
  FOR SELECT TO authenticated
  USING (
    client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid())
  );

-- ── 20260617200000_client_portal_checklist_rpc.sql ──
-- Client portal checklist sync (SECURITY DEFINER).
-- Clients cannot INSERT/UPDATE/DELETE document_requirements under RLS; RPC runs sync on their behalf.

CREATE OR REPLACE FUNCTION public._profession_template_rows(p_business_type text)
RETURNS TABLE(name text, doc_type text)
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT v.name, v.doc_type
  FROM (
    VALUES
      ('employee', 'W-2', 'w2'),
      ('employee', '1098 Mortgage Interest', '1098'),
      ('employee', '1099-INT', '1099-int'),
      ('freelancer', 'W-2', 'w2'),
      ('freelancer', '1099-NEC', '1099-nec'),
      ('freelancer', '1098 Mortgage Interest', '1098'),
      ('freelancer', 'Schedule C', 'sched-c'),
      ('partnership', 'W-2', 'w2'),
      ('partnership', '1099-NEC', '1099-nec'),
      ('partnership', '1098 Mortgage Interest', '1098'),
      ('partnership', 'Schedule C', 'sched-c'),
      ('partnership', 'K-1 Partnership', 'k1')
  ) AS v(business_type, name, doc_type)
  WHERE v.business_type = coalesce(nullif(p_business_type, ''), 'freelancer');
$$;

CREATE OR REPLACE FUNCTION public._portal_requirements_json(
  p_client_id uuid,
  p_tax_year text,
  p_business_type text
)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(
    jsonb_agg(to_jsonb(r) ORDER BY r.created_at),
    '[]'::jsonb
  )
  FROM public.document_requirements r
  WHERE r.client_id = p_client_id
    AND r.tax_year = p_tax_year
    AND r.required = true
    AND r.doc_type IN (
      SELECT t.doc_type FROM public._profession_template_rows(p_business_type) t
    );
$$;

CREATE OR REPLACE FUNCTION public._sync_checklist_to_profession(
  p_client_id uuid,
  p_tax_year text,
  p_business_type text,
  p_lock_profession boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_template record;
  v_req record;
  v_has_upload boolean;
  v_template_count integer;
  v_business_type text := coalesce(nullif(p_business_type, ''), 'freelancer');
BEGIN
  IF p_client_id IS NULL THEN
    RAISE EXCEPTION 'Client not found';
  END IF;

  SELECT count(*)::integer
  INTO v_template_count
  FROM public._profession_template_rows(v_business_type);

  FOR v_template IN
    SELECT t.name, t.doc_type
    FROM public._profession_template_rows(v_business_type) t
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM public.document_requirements r
      WHERE r.client_id = p_client_id
        AND r.tax_year = p_tax_year
        AND r.doc_type = v_template.doc_type
    ) THEN
      INSERT INTO public.document_requirements (
        client_id, name, doc_type, tax_year, required
      ) VALUES (
        p_client_id, v_template.name, v_template.doc_type, p_tax_year, true
      );
    END IF;
  END LOOP;

  FOR v_req IN
    SELECT *
    FROM public.document_requirements r
    WHERE r.client_id = p_client_id
      AND r.tax_year = p_tax_year
  LOOP
    IF EXISTS (
      SELECT 1
      FROM public._profession_template_rows(v_business_type) t
      WHERE t.doc_type = v_req.doc_type
    ) THEN
      IF NOT v_req.required THEN
        UPDATE public.document_requirements
        SET required = true
        WHERE id = v_req.id;
      END IF;
    ELSE
      SELECT EXISTS (
        SELECT 1
        FROM public.document_uploads u
        WHERE u.requirement_id = v_req.id
        LIMIT 1
      ) INTO v_has_upload;

      IF v_has_upload THEN
        IF v_req.required THEN
          UPDATE public.document_requirements
          SET required = false
          WHERE id = v_req.id;
        END IF;
      ELSE
        DELETE FROM public.document_requirements
        WHERE id = v_req.id;
      END IF;
    END IF;
  END LOOP;

  UPDATE public.clients
  SET business_type = v_business_type,
      documents_required = CASE
        WHEN p_tax_year = '2025' THEN v_template_count
        ELSE documents_required
      END,
      profession_locked = CASE
        WHEN p_lock_profession THEN true
        ELSE profession_locked
      END
  WHERE id = p_client_id;
END;
$$;

CREATE OR REPLACE FUNCTION public._client_id_for_auth_user()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.clients
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.client_ensure_portal_checklist(p_tax_year text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_business_type text;
BEGIN
  v_client_id := public._client_id_for_auth_user();
  IF v_client_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Client not found');
  END IF;

  SELECT coalesce(business_type, 'freelancer')
  INTO v_business_type
  FROM public.clients
  WHERE id = v_client_id;

  PERFORM public._sync_checklist_to_profession(
    v_client_id, p_tax_year, v_business_type, false
  );

  RETURN public._portal_requirements_json(v_client_id, p_tax_year, v_business_type);
END;
$$;

CREATE OR REPLACE FUNCTION public.client_update_profession(
  p_business_type text,
  p_lock_profession boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_locked boolean;
  v_prior_enabled boolean;
  v_business_type text := coalesce(nullif(p_business_type, ''), 'freelancer');
BEGIN
  v_client_id := public._client_id_for_auth_user();
  IF v_client_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Client not found');
  END IF;

  SELECT profession_locked, prior_year_upload_enabled
  INTO v_locked, v_prior_enabled
  FROM public.clients
  WHERE id = v_client_id;

  IF v_locked AND NOT p_lock_profession THEN
    RETURN jsonb_build_object('error', 'Profession is locked. Ask your preparer to unlock it on the portal.');
  END IF;

  PERFORM public._sync_checklist_to_profession(
    v_client_id, '2025', v_business_type, p_lock_profession
  );

  IF v_prior_enabled THEN
    PERFORM public._sync_checklist_to_profession(
      v_client_id, '2024', v_business_type, false
    );
  END IF;

  INSERT INTO public.activity_log (client_id, actor, actor_type, action)
  VALUES (
    v_client_id,
    'Client',
    'client',
    format('Set profession to %s and synced portal checklists', v_business_type)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'business_type', v_business_type,
    'requirements_2025', public._portal_requirements_json(v_client_id, '2025', v_business_type),
    'requirements_2024', CASE
      WHEN v_prior_enabled THEN public._portal_requirements_json(v_client_id, '2024', v_business_type)
      ELSE '[]'::jsonb
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.client_ensure_portal_checklist(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.client_update_profession(text, boolean) TO authenticated;

-- Ensure clients can still read their own requirements after security hardening.
DROP POLICY IF EXISTS "client read own reqs" ON public.document_requirements;
CREATE POLICY "client read own reqs" ON public.document_requirements
  FOR SELECT TO authenticated
  USING (
    client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid())
  );

-- ── 20260617210556_ac116b29-b35c-4ed5-8302-c3c4f3cd3ab3.sql ──

-- 1. time_entries: remove NULL user_id escape hatch
DROP POLICY IF EXISTS "user insert own time_entries" ON public.time_entries;
DROP POLICY IF EXISTS "user update own time_entries" ON public.time_entries;

CREATE POLICY "user insert own time_entries"
ON public.time_entries
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "user update own time_entries"
ON public.time_entries
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 2. clients: restrict client-self updates to safe columns via trigger
CREATE OR REPLACE FUNCTION public._clients_restrict_client_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Staff/admin can update anything
  IF public.is_staff() THEN
    RETURN NEW;
  END IF;

  -- Non-staff (clients editing own row): block protected fields
  IF NEW.status               IS DISTINCT FROM OLD.status
  OR NEW.documents_required   IS DISTINCT FROM OLD.documents_required
  OR NEW.documents_submitted  IS DISTINCT FROM OLD.documents_submitted
  OR NEW.assigned_staff       IS DISTINCT FROM OLD.assigned_staff
  OR NEW.assigned_preparer    IS DISTINCT FROM OLD.assigned_preparer
  OR NEW.profession_locked    IS DISTINCT FROM OLD.profession_locked
  OR NEW.year_upload_unlocks  IS DISTINCT FROM OLD.year_upload_unlocks
  OR NEW.prior_year_upload_enabled IS DISTINCT FROM OLD.prior_year_upload_enabled
  OR NEW.issues               IS DISTINCT FROM OLD.issues
  OR NEW.auth_user_id         IS DISTINCT FROM OLD.auth_user_id
  OR NEW.email                IS DISTINCT FROM OLD.email
  THEN
    RAISE EXCEPTION 'Clients cannot modify staff-controlled fields';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clients_restrict_client_updates ON public.clients;
CREATE TRIGGER clients_restrict_client_updates
BEFORE UPDATE ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public._clients_restrict_client_updates();

-- 3. Fix mutable search_path on two functions
CREATE OR REPLACE FUNCTION public._profession_template_rows(p_business_type text)
 RETURNS TABLE(name text, doc_type text)
 LANGUAGE sql
 IMMUTABLE
 SET search_path = public
AS $function$
  SELECT v.name, v.doc_type
  FROM (
    VALUES
      ('employee', 'W-2', 'w2'),
      ('employee', '1098 Mortgage Interest', '1098'),
      ('employee', '1099-INT', '1099-int'),
      ('freelancer', 'W-2', 'w2'),
      ('freelancer', '1099-NEC', '1099-nec'),
      ('freelancer', '1098 Mortgage Interest', '1098'),
      ('freelancer', 'Schedule C', 'sched-c'),
      ('partnership', 'W-2', 'w2'),
      ('partnership', '1099-NEC', '1099-nec'),
      ('partnership', '1098 Mortgage Interest', '1098'),
      ('partnership', 'Schedule C', 'sched-c'),
      ('partnership', 'K-1 Partnership', 'k1')
  ) AS v(business_type, name, doc_type)
  WHERE v.business_type = coalesce(nullif(p_business_type, ''), 'freelancer');
$function$;

CREATE OR REPLACE FUNCTION public._portal_requirements_json(p_client_id uuid, p_tax_year text, p_business_type text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path = public
AS $function$
  SELECT coalesce(
    jsonb_agg(to_jsonb(r) ORDER BY r.created_at),
    '[]'::jsonb
  )
  FROM public.document_requirements r
  WHERE r.client_id = p_client_id
    AND r.tax_year = p_tax_year
    AND r.required = true
    AND r.doc_type IN (
      SELECT t.doc_type FROM public._profession_template_rows(p_business_type) t
    );
$function$;

-- ── 20260617222247_ff9e9bc1-a81d-4e1e-a4cc-916fc33d53e1.sql ──
-- Multi-year client portal uploads: admin-enabled prior tax years (up to 30 back).

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS portal_enabled_years text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.clients.portal_enabled_years IS
  'Admin-enabled prior tax years visible on the client portal upload dropdown.';

UPDATE public.clients
SET portal_enabled_years = ARRAY['2024']
WHERE prior_year_upload_enabled = true
  AND (portal_enabled_years IS NULL OR portal_enabled_years = '{}');

CREATE OR REPLACE FUNCTION public.client_update_profession(
  p_business_type text,
  p_lock_profession boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_locked boolean;
  v_prior_enabled boolean;
  v_portal_years text[];
  v_year text;
  v_business_type text := coalesce(nullif(p_business_type, ''), 'freelancer');
  v_requirements_by_year jsonb := '{}'::jsonb;
BEGIN
  v_client_id := public._client_id_for_auth_user();
  IF v_client_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Client not found');
  END IF;

  SELECT profession_locked, prior_year_upload_enabled, portal_enabled_years
  INTO v_locked, v_prior_enabled, v_portal_years
  FROM public.clients
  WHERE id = v_client_id;

  IF v_locked AND NOT p_lock_profession THEN
    RETURN jsonb_build_object('error', 'Profession is locked. Ask your preparer to unlock it on the portal.');
  END IF;

  IF v_portal_years IS NULL OR coalesce(array_length(v_portal_years, 1), 0) = 0 THEN
    IF v_prior_enabled THEN
      v_portal_years := ARRAY['2024'];
    ELSE
      v_portal_years := '{}';
    END IF;
  END IF;

  PERFORM public._sync_checklist_to_profession(
    v_client_id, '2025', v_business_type, p_lock_profession
  );
  v_requirements_by_year := jsonb_build_object(
    '2025', public._portal_requirements_json(v_client_id, '2025', v_business_type)
  );

  FOREACH v_year IN ARRAY v_portal_years
  LOOP
    PERFORM public._sync_checklist_to_profession(
      v_client_id, v_year, v_business_type, false
    );
    v_requirements_by_year := v_requirements_by_year || jsonb_build_object(
      v_year, public._portal_requirements_json(v_client_id, v_year, v_business_type)
    );
  END LOOP;

  INSERT INTO public.activity_log (client_id, actor, actor_type, action)
  VALUES (
    v_client_id,
    'Client',
    'client',
    format('Set profession to %s and synced portal checklists', v_business_type)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'business_type', v_business_type,
    'requirements_by_year', v_requirements_by_year,
    'requirements_2025', v_requirements_by_year->'2025',
    'requirements_2024', coalesce(v_requirements_by_year->'2024', '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.client_update_profession(text, boolean) TO authenticated;
-- ── 20260617224425_f7b0044f-35ba-4881-a99b-c47d5fdc6a20.sql ──

CREATE OR REPLACE FUNCTION public._clients_restrict_client_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_bypass text;
BEGIN
  -- Staff/admin bypass
  IF public.is_staff() THEN
    RETURN NEW;
  END IF;

  -- Portal profession sync bypass (set by _sync_checklist_to_profession)
  BEGIN
    v_bypass := current_setting('app.portal_profession_sync', true);
  EXCEPTION WHEN OTHERS THEN
    v_bypass := NULL;
  END;
  IF v_bypass = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.status                    IS DISTINCT FROM OLD.status
  OR NEW.documents_required        IS DISTINCT FROM OLD.documents_required
  OR NEW.documents_submitted       IS DISTINCT FROM OLD.documents_submitted
  OR NEW.assigned_staff            IS DISTINCT FROM OLD.assigned_staff
  OR NEW.assigned_preparer         IS DISTINCT FROM OLD.assigned_preparer
  OR NEW.profession_locked         IS DISTINCT FROM OLD.profession_locked
  OR NEW.year_upload_unlocks       IS DISTINCT FROM OLD.year_upload_unlocks
  OR NEW.prior_year_upload_enabled IS DISTINCT FROM OLD.prior_year_upload_enabled
  OR NEW.portal_enabled_years      IS DISTINCT FROM OLD.portal_enabled_years
  OR NEW.issues                    IS DISTINCT FROM OLD.issues
  OR NEW.auth_user_id              IS DISTINCT FROM OLD.auth_user_id
  OR NEW.email                     IS DISTINCT FROM OLD.email
  THEN
    RAISE EXCEPTION 'Clients cannot modify staff-controlled fields';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public._sync_checklist_to_profession(
  p_client_id uuid,
  p_tax_year text,
  p_business_type text,
  p_lock_profession boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_template record;
  v_req record;
  v_has_upload boolean;
  v_template_count integer;
  v_business_type text := coalesce(nullif(p_business_type, ''), 'freelancer');
BEGIN
  IF p_client_id IS NULL THEN
    RAISE EXCEPTION 'Client not found';
  END IF;

  -- Allow trigger to permit staff-controlled column writes during portal sync
  PERFORM set_config('app.portal_profession_sync', 'on', true);

  SELECT count(*)::integer
  INTO v_template_count
  FROM public._profession_template_rows(v_business_type);

  FOR v_template IN
    SELECT t.name, t.doc_type
    FROM public._profession_template_rows(v_business_type) t
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.document_requirements r
      WHERE r.client_id = p_client_id
        AND r.tax_year = p_tax_year
        AND r.doc_type = v_template.doc_type
    ) THEN
      INSERT INTO public.document_requirements (client_id, name, doc_type, tax_year, required)
      VALUES (p_client_id, v_template.name, v_template.doc_type, p_tax_year, true);
    END IF;
  END LOOP;

  FOR v_req IN
    SELECT * FROM public.document_requirements r
    WHERE r.client_id = p_client_id AND r.tax_year = p_tax_year
  LOOP
    IF EXISTS (
      SELECT 1 FROM public._profession_template_rows(v_business_type) t
      WHERE t.doc_type = v_req.doc_type
    ) THEN
      IF NOT v_req.required THEN
        UPDATE public.document_requirements SET required = true WHERE id = v_req.id;
      END IF;
    ELSE
      SELECT EXISTS (
        SELECT 1 FROM public.document_uploads u WHERE u.requirement_id = v_req.id LIMIT 1
      ) INTO v_has_upload;

      IF v_has_upload THEN
        IF v_req.required THEN
          UPDATE public.document_requirements SET required = false WHERE id = v_req.id;
        END IF;
      ELSE
        DELETE FROM public.document_requirements WHERE id = v_req.id;
      END IF;
    END IF;
  END LOOP;

  UPDATE public.clients
  SET business_type = v_business_type,
      documents_required = CASE
        WHEN p_tax_year = '2025' THEN v_template_count
        ELSE documents_required
      END,
      profession_locked = CASE
        WHEN p_lock_profession THEN true
        ELSE profession_locked
      END
  WHERE id = p_client_id;

  PERFORM set_config('app.portal_profession_sync', 'off', true);
END;
$function$;

-- ── 20260618000000_app_metadata_role_security.sql ──
-- Security: read staff roles from auth.users.raw_app_meta_data (service-role writable only).
-- raw_user_meta_data is user-editable via supabase.auth.updateUser and must not gate RLS.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT COALESCE(
    (
      SELECT raw_app_meta_data->>'role' = 'admin'
      FROM auth.users
      WHERE id = auth.uid()
    ),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT COALESCE(
    (
      SELECT raw_app_meta_data->>'role' IN ('admin', 'preparer')
      FROM auth.users
      WHERE id = auth.uid()
    ),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_staff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated, service_role;

-- Backfill app_metadata.role from legacy user_metadata.role (one-time).
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('role', raw_user_meta_data->>'role')
WHERE raw_user_meta_data->>'role' IN ('admin', 'preparer', 'client')
  AND COALESCE(raw_app_meta_data->>'role', '') = '';

-- Remove trusted role from user-editable metadata after backfill.
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data - 'role'
WHERE raw_user_meta_data ? 'role'
  AND COALESCE(raw_app_meta_data->>'role', '') <> '';

COMMENT ON FUNCTION public.is_admin IS 'True when auth.users.raw_app_meta_data.role = admin (not user_metadata).';
COMMENT ON FUNCTION public.is_staff IS 'True when auth.users.raw_app_meta_data.role is admin or preparer.';

-- ── 20260618120000_portal_enabled_years.sql ──
-- Multi-year client portal uploads: admin-enabled prior tax years (up to 30 back).

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS portal_enabled_years text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.clients.portal_enabled_years IS
  'Admin-enabled prior tax years visible on the client portal upload dropdown.';

UPDATE public.clients
SET portal_enabled_years = ARRAY['2024']
WHERE prior_year_upload_enabled = true
  AND (portal_enabled_years IS NULL OR portal_enabled_years = '{}');

CREATE OR REPLACE FUNCTION public.client_update_profession(
  p_business_type text,
  p_lock_profession boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_locked boolean;
  v_prior_enabled boolean;
  v_portal_years text[];
  v_year text;
  v_business_type text := coalesce(nullif(p_business_type, ''), 'freelancer');
  v_requirements_by_year jsonb := '{}'::jsonb;
BEGIN
  v_client_id := public._client_id_for_auth_user();
  IF v_client_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Client not found');
  END IF;

  SELECT profession_locked, prior_year_upload_enabled, portal_enabled_years
  INTO v_locked, v_prior_enabled, v_portal_years
  FROM public.clients
  WHERE id = v_client_id;

  IF v_locked AND NOT p_lock_profession THEN
    RETURN jsonb_build_object('error', 'Profession is locked. Ask your preparer to unlock it on the portal.');
  END IF;

  IF v_portal_years IS NULL OR coalesce(array_length(v_portal_years, 1), 0) = 0 THEN
    IF v_prior_enabled THEN
      v_portal_years := ARRAY['2024'];
    ELSE
      v_portal_years := '{}';
    END IF;
  END IF;

  PERFORM public._sync_checklist_to_profession(
    v_client_id, '2025', v_business_type, p_lock_profession
  );
  v_requirements_by_year := jsonb_build_object(
    '2025', public._portal_requirements_json(v_client_id, '2025', v_business_type)
  );

  FOREACH v_year IN ARRAY v_portal_years
  LOOP
    PERFORM public._sync_checklist_to_profession(
      v_client_id, v_year, v_business_type, false
    );
    v_requirements_by_year := v_requirements_by_year || jsonb_build_object(
      v_year, public._portal_requirements_json(v_client_id, v_year, v_business_type)
    );
  END LOOP;

  INSERT INTO public.activity_log (client_id, actor, actor_type, action)
  VALUES (
    v_client_id,
    'Client',
    'client',
    format('Set profession to %s and synced portal checklists', v_business_type)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'business_type', v_business_type,
    'requirements_by_year', v_requirements_by_year,
    'requirements_2025', v_requirements_by_year->'2025',
    'requirements_2024', coalesce(v_requirements_by_year->'2024', '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.client_update_profession(text, boolean) TO authenticated;

-- ── 20260618180000_portal_profession_sync_trigger_bypass.sql ──
-- Portal profession RPC updates clients.profession_locked and documents_required.
-- The client self-update trigger (20260617210556) blocks those columns for non-staff,
-- which breaks client_update_profession even though it runs as SECURITY DEFINER.
-- Set a transaction-local flag during trusted portal sync so the trigger allows it.

CREATE OR REPLACE FUNCTION public._clients_restrict_client_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF public.is_staff() THEN
    RETURN NEW;
  END IF;

  -- Trusted portal profession/checklist sync (client_update_profession RPC).
  IF current_setting('app.portal_profession_sync', true) = '1' THEN
    RETURN NEW;
  END IF;

  IF NEW.status               IS DISTINCT FROM OLD.status
  OR NEW.documents_required   IS DISTINCT FROM OLD.documents_required
  OR NEW.documents_submitted  IS DISTINCT FROM OLD.documents_submitted
  OR NEW.assigned_staff       IS DISTINCT FROM OLD.assigned_staff
  OR NEW.assigned_preparer    IS DISTINCT FROM OLD.assigned_preparer
  OR NEW.profession_locked    IS DISTINCT FROM OLD.profession_locked
  OR NEW.year_upload_unlocks  IS DISTINCT FROM OLD.year_upload_unlocks
  OR NEW.prior_year_upload_enabled IS DISTINCT FROM OLD.prior_year_upload_enabled
  OR NEW.portal_enabled_years IS DISTINCT FROM OLD.portal_enabled_years
  OR NEW.issues               IS DISTINCT FROM OLD.issues
  OR NEW.auth_user_id         IS DISTINCT FROM OLD.auth_user_id
  OR NEW.email                IS DISTINCT FROM OLD.email
  THEN
    RAISE EXCEPTION 'Clients cannot modify staff-controlled fields';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public._sync_checklist_to_profession(
  p_client_id uuid,
  p_tax_year text,
  p_business_type text,
  p_lock_profession boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_template record;
  v_req record;
  v_has_upload boolean;
  v_template_count integer;
  v_business_type text := coalesce(nullif(p_business_type, ''), 'freelancer');
BEGIN
  IF p_client_id IS NULL THEN
    RAISE EXCEPTION 'Client not found';
  END IF;

  SELECT count(*)::integer
  INTO v_template_count
  FROM public._profession_template_rows(v_business_type);

  FOR v_template IN
    SELECT t.name, t.doc_type
    FROM public._profession_template_rows(v_business_type) t
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM public.document_requirements r
      WHERE r.client_id = p_client_id
        AND r.tax_year = p_tax_year
        AND r.doc_type = v_template.doc_type
    ) THEN
      INSERT INTO public.document_requirements (
        client_id, name, doc_type, tax_year, required
      ) VALUES (
        p_client_id, v_template.name, v_template.doc_type, p_tax_year, true
      );
    END IF;
  END LOOP;

  FOR v_req IN
    SELECT *
    FROM public.document_requirements r
    WHERE r.client_id = p_client_id
      AND r.tax_year = p_tax_year
  LOOP
    IF EXISTS (
      SELECT 1
      FROM public._profession_template_rows(v_business_type) t
      WHERE t.doc_type = v_req.doc_type
    ) THEN
      IF NOT v_req.required THEN
        UPDATE public.document_requirements
        SET required = true
        WHERE id = v_req.id;
      END IF;
    ELSE
      SELECT EXISTS (
        SELECT 1
        FROM public.document_uploads u
        WHERE u.requirement_id = v_req.id
        LIMIT 1
      ) INTO v_has_upload;

      IF v_has_upload THEN
        IF v_req.required THEN
          UPDATE public.document_requirements
          SET required = false
          WHERE id = v_req.id;
        END IF;
      ELSE
        DELETE FROM public.document_requirements
        WHERE id = v_req.id;
      END IF;
    END IF;
  END LOOP;

  PERFORM set_config('app.portal_profession_sync', '1', true);

  UPDATE public.clients
  SET business_type = v_business_type,
      documents_required = CASE
        WHEN p_tax_year = '2025' THEN v_template_count
        ELSE documents_required
      END,
      profession_locked = CASE
        WHEN p_lock_profession THEN true
        ELSE profession_locked
      END
  WHERE id = p_client_id;

  PERFORM set_config('app.portal_profession_sync', '', true);
END;
$$;

-- ── 20260619120000_staff_rls_demo_fallback.sql ──
-- Allow demo staff RLS when app_metadata.role is not set yet (local / pre-backfill).
-- Primary trust remains raw_app_meta_data.role; fallbacks are demo-only.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT COALESCE(
    (
      SELECT
        raw_app_meta_data->>'role' = 'admin'
        OR (
          COALESCE(raw_app_meta_data->>'role', '') = ''
          AND raw_user_meta_data->>'role' = 'admin'
        )
        OR lower(email) = 'nick@brodermansoor.com'
      FROM auth.users
      WHERE id = auth.uid()
    ),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT COALESCE(
    (
      SELECT
        raw_app_meta_data->>'role' IN ('admin', 'preparer')
        OR (
          COALESCE(raw_app_meta_data->>'role', '') = ''
          AND raw_user_meta_data->>'role' IN ('admin', 'preparer')
        )
        OR lower(email) IN (
          'nick@brodermansoor.com',
          'shawn@brodermansoor.com',
          'girik@brodermansoor.com'
        )
      FROM auth.users
      WHERE id = auth.uid()
    ),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_staff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated, service_role;


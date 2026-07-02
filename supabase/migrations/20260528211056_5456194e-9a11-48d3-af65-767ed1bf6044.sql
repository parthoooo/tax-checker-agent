
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
      'nick@brodermansoor.com', extensions.crypt('password123', extensions.gen_salt('bf')),
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
      'john.smith@email.com', extensions.crypt('password123', extensions.gen_salt('bf')),
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

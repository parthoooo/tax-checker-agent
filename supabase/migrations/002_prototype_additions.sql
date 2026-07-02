
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
      'shawn@brodermansoor.com', extensions.crypt('password123', extensions.gen_salt('bf')),
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
      'girik@brodermansoor.com', extensions.crypt('password123', extensions.gen_salt('bf')),
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

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

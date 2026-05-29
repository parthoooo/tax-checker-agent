
revoke execute on function public.is_admin() from public, anon, authenticated;
grant execute on function public.is_admin() to service_role;

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
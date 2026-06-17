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

-- Tax-Checker hackathon branding: demo staff emails + default from address

ALTER TABLE public.email_drafts
  ALTER COLUMN from_label SET DEFAULT 'support@tax-checker.demo';

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
        OR lower(email) = 'admin@tax-checker.demo'
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
          'admin@tax-checker.demo',
          'preparer1@tax-checker.demo',
          'preparer2@tax-checker.demo'
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

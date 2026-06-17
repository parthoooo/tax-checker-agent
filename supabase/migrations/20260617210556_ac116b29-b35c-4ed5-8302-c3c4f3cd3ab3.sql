
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

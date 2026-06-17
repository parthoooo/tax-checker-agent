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

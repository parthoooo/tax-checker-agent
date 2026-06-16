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
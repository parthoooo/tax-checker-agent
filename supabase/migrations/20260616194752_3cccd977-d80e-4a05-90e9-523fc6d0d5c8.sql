ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS business_type text NOT NULL DEFAULT 'freelancer'
    CHECK (business_type IN ('employee', 'freelancer', 'partnership'));

CREATE TABLE IF NOT EXISTS public.client_corrections (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  tax_year            text NOT NULL DEFAULT '2025',
  comparison_snapshot jsonb NOT NULL,
  staff_message       text,
  status              text NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent', 'resolved')),
  sent_by             text,
  sent_at             timestamptz NOT NULL DEFAULT now(),
  resolved_at         timestamptz
);

CREATE INDEX IF NOT EXISTS idx_client_corrections_client_status
  ON public.client_corrections (client_id, status, sent_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.client_corrections TO authenticated;
GRANT ALL ON public.client_corrections TO service_role;

ALTER TABLE public.client_corrections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client read own corrections" ON public.client_corrections;
CREATE POLICY "client read own corrections" ON public.client_corrections
  FOR SELECT TO authenticated
  USING (client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "demo authenticated manage corrections" ON public.client_corrections;
CREATE POLICY "demo authenticated manage corrections" ON public.client_corrections
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.submit_documents_via_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id   uuid;
  v_client      clients%ROWTYPE;
  v_verified    int;
  v_required    int;
BEGIN
  SELECT mlt.client_id INTO v_client_id
  FROM magic_link_tokens mlt
  WHERE mlt.token = p_token
    AND (mlt.expires_at IS NULL OR mlt.expires_at > now());

  IF v_client_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Invalid or expired upload link');
  END IF;

  SELECT * INTO v_client FROM clients WHERE id = v_client_id;

  SELECT
    COUNT(*) FILTER (WHERE u.ai_status = 'verified'),
    COUNT(*)
  INTO v_verified, v_required
  FROM document_requirements r
  LEFT JOIN document_uploads u
    ON u.requirement_id = r.id
   AND u.client_id = r.client_id
   AND u.tax_year = '2025'
   AND COALESCE(u.is_prior_year, false) = false
  WHERE r.client_id = v_client_id
    AND r.tax_year = '2025'
    AND r.required = true;

  IF v_required = 0 OR v_verified < v_required THEN
    RETURN jsonb_build_object(
      'error', 'All required documents must be verified before submitting',
      'verified', v_verified,
      'required', v_required
    );
  END IF;

  UPDATE clients
  SET status = 'complete',
      documents_submitted = v_verified,
      documents_required = v_required,
      issues = 0,
      last_activity = now()
  WHERE id = v_client_id;

  INSERT INTO activity_log (client_id, actor, actor_type, action)
  VALUES (
    v_client_id,
    v_client.name,
    'client',
    'Submitted all 2025 documents for preparer review (magic link)'
  );

  RETURN jsonb_build_object(
    'ok', true,
    'client_id', v_client_id,
    'client_name', v_client.name,
    'client_email', v_client.email,
    'verified', v_verified
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_documents_via_token(text) TO anon, authenticated;

-- email_drafts
CREATE TABLE public.email_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  to_email text NOT NULL,
  from_label text,
  subject text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_drafts TO authenticated;
GRANT ALL ON public.email_drafts TO service_role;

ALTER TABLE public.email_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin all email_drafts"
  ON public.email_drafts FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "demo authenticated read email_drafts"
  ON public.email_drafts FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "authenticated insert email_drafts"
  ON public.email_drafts FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated update email_drafts"
  ON public.email_drafts FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_email_drafts_status ON public.email_drafts(status);
CREATE INDEX idx_email_drafts_client ON public.email_drafts(client_id);

-- time_entries
CREATE TABLE public.time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  user_id uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_entries TO authenticated;
GRANT ALL ON public.time_entries TO service_role;

ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin all time_entries"
  ON public.time_entries FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "demo authenticated read time_entries"
  ON public.time_entries FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "user insert own time_entries"
  ON public.time_entries FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "user update own time_entries"
  ON public.time_entries FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL)
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE INDEX idx_time_entries_client ON public.time_entries(client_id);
CREATE INDEX idx_time_entries_started ON public.time_entries(started_at);

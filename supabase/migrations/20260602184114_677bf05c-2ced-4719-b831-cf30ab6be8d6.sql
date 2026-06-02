-- Ensure authenticated users (admin/preparer demo accounts) can write to the
-- tables used by the demo data seeder. Matches the existing "demo authenticated
-- read" policies that already allow reads.

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_requirements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_uploads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_flags TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_log TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_drafts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reminders TO authenticated;

GRANT ALL ON public.clients TO service_role;
GRANT ALL ON public.document_requirements TO service_role;
GRANT ALL ON public.document_uploads TO service_role;
GRANT ALL ON public.ai_flags TO service_role;
GRANT ALL ON public.activity_log TO service_role;
GRANT ALL ON public.email_drafts TO service_role;
GRANT ALL ON public.time_entries TO service_role;
GRANT ALL ON public.reminders TO service_role;

-- Demo write policies for authenticated users (so the in-app "Load Demo Data"
-- button works for admin + preparer logins). These complement the existing
-- "demo authenticated read" SELECT policies and the admin-only ALL policies.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='clients' AND policyname='demo authenticated write clients') THEN
    EXECUTE 'CREATE POLICY "demo authenticated write clients" ON public.clients FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='document_requirements' AND policyname='demo authenticated write reqs') THEN
    EXECUTE 'CREATE POLICY "demo authenticated write reqs" ON public.document_requirements FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='document_uploads' AND policyname='demo authenticated write uploads') THEN
    EXECUTE 'CREATE POLICY "demo authenticated write uploads" ON public.document_uploads FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ai_flags' AND policyname='demo authenticated write flags') THEN
    EXECUTE 'CREATE POLICY "demo authenticated write flags" ON public.ai_flags FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='activity_log' AND policyname='demo authenticated write activity') THEN
    EXECUTE 'CREATE POLICY "demo authenticated write activity" ON public.activity_log FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='time_entries' AND policyname='demo authenticated write time_entries') THEN
    EXECUTE 'CREATE POLICY "demo authenticated write time_entries" ON public.time_entries FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='reminders' AND policyname='demo authenticated write reminders') THEN
    EXECUTE 'CREATE POLICY "demo authenticated write reminders" ON public.reminders FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;
END$$;

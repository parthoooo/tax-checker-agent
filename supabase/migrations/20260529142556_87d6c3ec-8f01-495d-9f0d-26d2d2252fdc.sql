
CREATE POLICY "demo authenticated read clients"        ON public.clients              FOR SELECT TO authenticated USING (true);
CREATE POLICY "demo authenticated read reqs"           ON public.document_requirements FOR SELECT TO authenticated USING (true);
CREATE POLICY "demo authenticated read uploads"        ON public.document_uploads     FOR SELECT TO authenticated USING (true);
CREATE POLICY "demo authenticated read flags"          ON public.ai_flags             FOR SELECT TO authenticated USING (true);
CREATE POLICY "demo authenticated read activity"       ON public.activity_log         FOR SELECT TO authenticated USING (true);
CREATE POLICY "demo authenticated read reminders"      ON public.reminders            FOR SELECT TO authenticated USING (true);

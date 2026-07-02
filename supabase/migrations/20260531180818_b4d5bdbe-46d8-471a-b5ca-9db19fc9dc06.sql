DO $$ BEGIN
  ALTER TABLE public.email_drafts
    ADD CONSTRAINT email_drafts_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.time_entries
    ADD CONSTRAINT time_entries_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

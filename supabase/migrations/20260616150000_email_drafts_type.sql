-- Discriminator for Outbox vs Reminder workflows
ALTER TABLE public.email_drafts
  ADD COLUMN IF NOT EXISTS type text CHECK (type IS NULL OR type IN ('outbox', 'reminder'));

CREATE INDEX IF NOT EXISTS idx_email_drafts_type ON public.email_drafts(type);

-- Chat rebuild (user-approved wipe of all existing messages)
DELETE FROM public.messages;

-- Message states (Sent/Delivered/Read) + soft delete
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS read_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS has_attachments boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_messages_case_created ON public.messages (case_id, created_at);

-- Dedicated attachments table (images / videos / pdf / future types)
CREATE TABLE IF NOT EXISTS public.message_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_type text,
  mime_type text,
  file_size integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_message_attachments_message ON public.message_attachments (message_id);

ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS attachments_select ON public.message_attachments;
CREATE POLICY attachments_select ON public.message_attachments
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.messages m WHERE m.id = message_id));

DROP POLICY IF EXISTS attachments_insert ON public.message_attachments;
CREATE POLICY attachments_insert ON public.message_attachments
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.messages m WHERE m.id = message_id AND m.sender_id = auth.uid()));

-- Receipts via SECURITY DEFINER (recipient can mark delivered/read without editing content)
CREATE OR REPLACE FUNCTION public.mark_conversation_delivered(p_case_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE public.messages
  SET delivered_at = now()
  WHERE case_id = p_case_id AND sender_id <> auth.uid() AND delivered_at IS NULL AND deleted_at IS NULL
    AND EXISTS (SELECT 1 FROM public.cases c WHERE c.id = p_case_id AND (
      c.client_id = auth.uid() OR c.lawyer_id = auth.uid()
      OR c.lawyer_id = (SELECT master_lawyer_id FROM public.profiles WHERE id = auth.uid())
      OR c.lawyer_id IN (SELECT id FROM public.profiles WHERE master_lawyer_id = auth.uid())));
END; $$;

CREATE OR REPLACE FUNCTION public.mark_conversation_read(p_case_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE public.messages
  SET read_at = now(), delivered_at = COALESCE(delivered_at, now())
  WHERE case_id = p_case_id AND sender_id <> auth.uid() AND read_at IS NULL AND deleted_at IS NULL
    AND EXISTS (SELECT 1 FROM public.cases c WHERE c.id = p_case_id AND (
      c.client_id = auth.uid() OR c.lawyer_id = auth.uid()
      OR c.lawyer_id = (SELECT master_lawyer_id FROM public.profiles WHERE id = auth.uid())
      OR c.lawyer_id IN (SELECT id FROM public.profiles WHERE master_lawyer_id = auth.uid())));
END; $$;

REVOKE EXECUTE ON FUNCTION public.mark_conversation_delivered(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mark_conversation_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_conversation_delivered(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_conversation_read(uuid) TO authenticated;

-- Deliver attachment rows in realtime (RLS-filtered)
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_attachments;

-- Secure admin <-> employee workplace messaging.

CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  pinned_by_admin BOOLEAN NOT NULL DEFAULT false,
  archived_by_admin BOOLEAN NOT NULL DEFAULT false,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE RESTRICT,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  recipient_id UUID REFERENCES auth.users(id) ON DELETE RESTRICT,
  sender_is_admin BOOLEAN NOT NULL,
  body TEXT,
  attachment_name TEXT,
  attachment_path TEXT,
  attachment_type TEXT,
  attachment_size BIGINT,
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sender_ip INET,
  CONSTRAINT chat_message_has_content CHECK (
    nullif(btrim(coalesce(body, '')), '') IS NOT NULL OR attachment_path IS NOT NULL
  ),
  CONSTRAINT chat_attachment_complete CHECK (
    attachment_path IS NULL OR (attachment_name IS NOT NULL AND attachment_type IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.chat_presence (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_online BOOLEAN NOT NULL DEFAULT false,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  typing_conversation_id UUID REFERENCES public.chat_conversations(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_last_message
  ON public.chat_conversations(pinned_by_admin DESC, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_created
  ON public.chat_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_unread
  ON public.chat_messages(conversation_id, sender_is_admin, read_at)
  WHERE read_at IS NULL;

ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat participants view conversations"
  ON public.chat_conversations FOR SELECT
  USING (public.is_admin(auth.uid()) OR employee_id = auth.uid());

CREATE POLICY "chat participants start conversations"
  ON public.chat_conversations FOR INSERT
  WITH CHECK (
    (public.is_admin(auth.uid()) AND NOT public.is_admin(employee_id))
    OR employee_id = auth.uid()
  );

CREATE POLICY "chat participants view messages"
  ON public.chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = conversation_id
        AND (public.is_admin(auth.uid()) OR c.employee_id = auth.uid())
    )
  );

CREATE POLICY "chat participants send messages"
  ON public.chat_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND sender_is_admin = public.is_admin(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = conversation_id
        AND (
          (public.is_admin(auth.uid()) AND recipient_id = c.employee_id)
          OR (c.employee_id = auth.uid() AND recipient_id IS NULL)
        )
    )
  );

CREATE POLICY "users view relevant chat presence"
  ON public.chat_presence FOR SELECT
  USING (
    public.is_admin(auth.uid())
    OR user_id = auth.uid()
    OR public.is_admin(user_id)
  );

CREATE POLICY "users create own chat presence"
  ON public.chat_presence FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users update own chat presence"
  ON public.chat_presence FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Employees need the admin identity/avatar in their official chat header.
CREATE POLICY "employees view admin profiles for chat"
  ON public.profiles FOR SELECT
  USING (public.is_admin(user_id));

CREATE POLICY "employees identify admin roles for chat"
  ON public.user_roles FOR SELECT
  USING (role IN ('super_admin', 'admin', 'hr_manager'));

CREATE OR REPLACE FUNCTION public.touch_chat_conversation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.chat_conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_chat_conversation ON public.chat_messages;
CREATE TRIGGER trg_touch_chat_conversation
AFTER INSERT ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.touch_chat_conversation();

CREATE OR REPLACE FUNCTION public.notify_chat_recipient()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sender_name TEXT;
  _preview TEXT;
BEGIN
  SELECT coalesce(full_name, 'Team member') INTO _sender_name
  FROM public.profiles WHERE user_id = NEW.sender_id;
  _preview := coalesce(nullif(left(btrim(NEW.body), 120), ''), 'Sent an attachment');

  IF NEW.sender_is_admin THEN
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (NEW.recipient_id, 'New message from Admin', _preview, 'message');
  ELSE
    INSERT INTO public.notifications (user_id, title, message, type)
    SELECT DISTINCT r.user_id, 'New message from ' || _sender_name, _preview, 'message'
    FROM public.user_roles r
    WHERE r.role IN ('super_admin', 'admin', 'hr_manager')
      AND r.user_id <> NEW.sender_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_chat_recipient ON public.chat_messages;
CREATE TRIGGER trg_notify_chat_recipient
AFTER INSERT ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_chat_recipient();

CREATE OR REPLACE FUNCTION public.mark_chat_messages_read(_conversation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _employee_id UUID;
BEGIN
  SELECT employee_id INTO _employee_id
  FROM public.chat_conversations
  WHERE id = _conversation_id;

  IF _employee_id IS NULL
     OR (NOT public.is_admin(auth.uid()) AND _employee_id <> auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized for this conversation';
  END IF;

  UPDATE public.chat_messages
  SET read_at = now()
  WHERE conversation_id = _conversation_id
    AND read_at IS NULL
    AND (
      (public.is_admin(auth.uid()) AND sender_is_admin = false)
      OR (_employee_id = auth.uid() AND sender_is_admin = true)
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.set_chat_conversation_flags(
  _conversation_id UUID,
  _pinned BOOLEAN DEFAULT NULL,
  _archived BOOLEAN DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  UPDATE public.chat_conversations
  SET pinned_by_admin = coalesce(_pinned, pinned_by_admin),
      archived_by_admin = coalesce(_archived, archived_by_admin)
  WHERE id = _conversation_id;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_chat_messages_read(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_chat_conversation_flags(UUID, BOOLEAN, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_chat_messages_read(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_chat_conversation_flags(UUID, BOOLEAN, BOOLEAN) TO authenticated;

-- Private chat files. Paths are conversation-id/user-id/file-name.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-attachments',
  'chat-attachments',
  false,
  52428800,
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif',
    'video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "chat participants upload attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-attachments'
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id::text = (storage.foldername(name))[1]
        AND (public.is_admin(auth.uid()) OR c.employee_id = auth.uid())
    )
  );

CREATE POLICY "chat participants view attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id::text = (storage.foldername(name))[1]
        AND (public.is_admin(auth.uid()) OR c.employee_id = auth.uid())
    )
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_presence;

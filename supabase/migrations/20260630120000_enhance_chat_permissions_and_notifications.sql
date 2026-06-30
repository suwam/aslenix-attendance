-- Enhance chat system: Allow employees to message specific HRs/admins, and treat HR positions as admins in chat.

-- 1. Update public.is_admin SQL function
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path=public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role IN ('super_admin','admin','hr_manager')
  ) OR EXISTS (
    SELECT 1 FROM public.profiles WHERE user_id=_user_id AND (position ILIKE '%HR%' OR position ILIKE '%Human Resources%')
  );
$$;

-- 2. Redefine policy for sending chat messages to allow setting specific admin/HR recipients
DROP POLICY IF EXISTS "chat participants send messages" ON public.chat_messages;
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
          OR (c.employee_id = auth.uid() AND (recipient_id IS NULL OR public.is_admin(recipient_id)))
        )
    )
  );

-- 3. Update notification trigger to support single recipient notifications
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
    IF NEW.recipient_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, type)
      VALUES (NEW.recipient_id, 'New message from ' || _sender_name, _preview, 'message');
    ELSE
      INSERT INTO public.notifications (user_id, title, message, type)
      SELECT DISTINCT r.user_id, 'New message from ' || _sender_name, _preview, 'message'
      FROM public.user_roles r
      WHERE r.role IN ('super_admin', 'admin', 'hr_manager')
        AND r.user_id <> NEW.sender_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

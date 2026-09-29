-- Fix WhatsApp RLS policies to use has_role correctly

DROP POLICY IF EXISTS "Admins can update whatsapp settings" ON whatsapp_settings;
DROP POLICY IF EXISTS "Admins can insert whatsapp settings" ON whatsapp_settings;
DROP POLICY IF EXISTS "Admins can manage notifications" ON whatsapp_notifications;

CREATE POLICY "Admins can update whatsapp settings" ON whatsapp_settings FOR UPDATE USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'super_admin') OR 
  public.has_role(auth.uid(), 'hr_manager')
);

CREATE POLICY "Admins can insert whatsapp settings" ON whatsapp_settings FOR INSERT WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'super_admin') OR 
  public.has_role(auth.uid(), 'hr_manager')
);

CREATE POLICY "Admins can manage notifications" ON whatsapp_notifications FOR ALL USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'super_admin') OR 
  public.has_role(auth.uid(), 'hr_manager')
) WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'super_admin') OR 
  public.has_role(auth.uid(), 'hr_manager')
);

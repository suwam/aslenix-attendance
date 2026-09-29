-- Enable pg_net
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Function to call the edge function
CREATE OR REPLACE FUNCTION public.trigger_whatsapp_edge_function()
RETURNS TRIGGER AS $$
DECLARE
  request_body JSONB;
BEGIN
  -- Build the JSON payload to simulate the webhook structure
  request_body := jsonb_build_object(
    'type', TG_OP,
    'table', TG_TABLE_NAME,
    'schema', TG_TABLE_SCHEMA,
    'record', row_to_json(NEW)
  );

  -- Perform the async HTTP POST request using pg_net
  -- NOTE: The edge function has been configured to use the x-webhook-secret header
  PERFORM net.http_post(
      url:='https://bbhsjjosmjtfmjveyjnf.supabase.co/functions/v1/whatsapp-sender',
      body:=request_body,
      headers:='{"Content-Type": "application/json", "x-webhook-secret": "6709a4a18d4843c9bda94898b151214475d652d145069c5f02c7dec5887aaaf7"}'::jsonb
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS on_whatsapp_notification_queued ON public.whatsapp_notifications;
CREATE TRIGGER on_whatsapp_notification_queued
  AFTER INSERT ON public.whatsapp_notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_whatsapp_edge_function();

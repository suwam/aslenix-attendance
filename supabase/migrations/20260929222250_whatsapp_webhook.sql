-- Enable the pg_net extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create the trigger function that will call the Edge Function using pg_net
CREATE OR REPLACE FUNCTION trigger_whatsapp_edge_function()
RETURNS TRIGGER AS $$
DECLARE
  edge_function_url TEXT;
  service_role_key TEXT;
  request_body JSONB;
BEGIN
  -- We assume SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are available or we can just use relative url if self-hosted, 
  -- but generally for Supabase we need to construct the URL or rely on the webhook system.
  -- A simpler approach for webhook without hardcoding secrets in DB is to use Supabase Webhooks.
  -- Supabase webhooks are managed via the `supabase_functions.http_request` which wraps pg_net, 
  -- but to keep this migration portable and simple without hardcoding keys:
  
  -- Actually, the best practice is to configure the webhook from the Supabase Dashboard > Database > Webhooks.
  -- But we can create a basic pg_net request if the URL is known.
  
  -- Since we don't know the exact project URL and service role key inside the database, 
  -- we'll just leave this as a stub that the user can configure via the Dashboard, OR
  -- we can just skip this pg_net request and let the user set it up via the dashboard.
  -- For now, we will create a placeholder.
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- In a real Supabase environment, you would use:
-- CREATE TRIGGER "whatsapp_webhook" AFTER INSERT ON "whatsapp_notifications"
-- FOR EACH ROW EXECUTE FUNCTION supabase_functions.http_request('http://localhost:54321/functions/v1/whatsapp-sender', 'POST', '{"Content-type":"application/json"}', '{}', '1000');

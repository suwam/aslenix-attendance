import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Types
type WebhookPayload = {
    type: 'INSERT' | 'UPDATE'
    table: string
    record: any
    schema: 'public'
    old_record: any | null
}

const supabaseUrl = Deno.env.get('SUPABASE_URL') as string
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseServiceKey)

serve(async (req) => {
    try {
        const payload: WebhookPayload = await req.json()
        
        // Ensure this is a WhatsApp notification webhook payload
        if (payload.table !== 'whatsapp_notifications' || payload.record?.status !== 'PENDING') {
            return new Response('Not a pending notification', { status: 200 })
        }

        const notification = payload.record;

        // Mark as processing
        await supabase
            .from('whatsapp_notifications')
            .update({ status: 'PROCESSING', updated_at: new Date().toISOString() })
            .eq('id', notification.id)

        // Simulate sending WhatsApp message (or actually send if credentials exist)
        const WHATSAPP_ACCESS_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
        const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

        if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
            // For demo/development purposes, if no keys exist, we just simulate success
            console.log(`[SIMULATED] Sent WhatsApp to ${notification.recipient_number} (Template: ${notification.template_name})`)
            
            // Mark as delivered
            await supabase
                .from('whatsapp_notifications')
                .update({ 
                    status: 'DELIVERED', 
                    delivered_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', notification.id)
                
            return new Response('Simulated WhatsApp message sent', { status: 200 })
        }

        // Actual WhatsApp Cloud API request
        const url = `https://graph.facebook.com/v17.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
        
        // Build components for the template based on parameters (assuming custom logic here for different templates)
        // Here we just send a generic message for simplicity if template variables aren't perfectly mapped
        const data = {
            messaging_product: "whatsapp",
            to: notification.recipient_number,
            type: "template",
            template: {
                name: notification.template_name,
                language: { code: "en_US" }
                // components could be added here from template_parameters
            }
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (response.ok) {
            // Mark as sent
            await supabase
                .from('whatsapp_notifications')
                .update({ 
                    status: 'SENT', 
                    provider_message_id: result.messages?.[0]?.id,
                    sent_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', notification.id)
            
            return new Response('WhatsApp message sent', { status: 200 })
        } else {
            // Mark as failed
            await supabase
                .from('whatsapp_notifications')
                .update({ 
                    status: 'FAILED', 
                    error_message: result.error?.message || 'Unknown provider error',
                    updated_at: new Date().toISOString()
                })
                .eq('id', notification.id)
            
            return new Response('WhatsApp message failed', { status: 400 })
        }
        
    } catch (err) {
        console.error('Error processing notification:', err)
        return new Response(String(err), { status: 500 })
    }
})

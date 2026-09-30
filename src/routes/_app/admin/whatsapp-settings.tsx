import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { MessageCircle, Settings, Send, History } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_app/admin/whatsapp-settings")({ component: WhatsAppSettings });

function WhatsAppSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<any>(null);

  const [testNumber, setTestNumber] = useState("");
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("whatsapp_settings").select("*").limit(1).single();
    if (data) {
      setSettings(data);
    } else if (error && error.code !== "PGRST116") {
      toast.error(error.message);
    }
    setLoading(false);
  };

  const updateSetting = async (key: string, value: any) => {
    if (!settings) return;
    setSaving(true);
    const { error } = await supabase
      .from("whatsapp_settings")
      .update({ [key]: value } as any)
      .eq("id", settings.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      setSettings({ ...settings, [key]: value });
      toast.success("Settings updated");
    }
  };

  const handleTest = async () => {
    if (!testNumber) return toast.error("Please enter a test number");
    setTesting(true);
    
    // Simulate API call to queue test message
    const { error } = await supabase.from("whatsapp_notifications").insert({
        notification_type: 'TEST_MESSAGE',
        recipient_number: testNumber,
        template_name: 'hello_world',
        template_parameters: { test: true },
        status: 'PENDING'
    });

    setTesting(false);
    if (error) {
        toast.error("Failed to queue test message: " + error.message);
    } else {
        toast.success("Test message queued successfully!");
        setTestNumber("");
    }
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading settings...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <PageHeader title="WhatsApp Integration" subtitle="Configure automatic WhatsApp notifications for attendance" />
          <Button asChild variant="outline" className="rounded-xl font-bold">
             <Link to="/admin/whatsapp-history">
               <History className="mr-2 size-4" /> View History
             </Link>
          </Button>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <GlassCard className="p-6">
          <div className="flex items-center gap-3 mb-6 border-b pb-4">
             <div className="p-3 rounded-xl bg-green-500/10 text-green-500">
               <MessageCircle className="size-6" />
             </div>
             <div>
               <h2 className="text-xl font-bold">Main Settings</h2>
               <p className="text-sm text-muted-foreground">Enable or disable WhatsApp functionality</p>
             </div>
          </div>

          <div className="space-y-6">
             <div className="flex items-center justify-between">
                <div>
                   <Label className="text-base font-bold">Enable WhatsApp Integration</Label>
                   <p className="text-sm text-muted-foreground">Turn on automatic WhatsApp notifications globally.</p>
                </div>
                <Switch 
                   checked={settings?.is_enabled || false} 
                   onCheckedChange={(c) => updateSetting('is_enabled', c)} 
                   disabled={saving}
                />
             </div>

             <div className="flex items-center justify-between pt-4 border-t">
                <div>
                   <Label className="text-base font-bold">Check-In Notifications</Label>
                   <p className="text-sm text-muted-foreground">Send when an employee successfully checks in.</p>
                </div>
                <Switch 
                   checked={settings?.send_checkin || false} 
                   onCheckedChange={(c) => updateSetting('send_checkin', c)} 
                   disabled={saving || !settings?.is_enabled}
                />
             </div>

             <div className="flex items-center justify-between pt-4 border-t">
                <div>
                   <Label className="text-base font-bold">Check-Out Notifications</Label>
                   <p className="text-sm text-muted-foreground">Send when an employee successfully checks out.</p>
                </div>
                <Switch 
                   checked={settings?.send_checkout || false} 
                   onCheckedChange={(c) => updateSetting('send_checkout', c)} 
                   disabled={saving || !settings?.is_enabled}
                />
             </div>

             <div className="flex items-center justify-between pt-4 border-t">
                <div>
                   <Label className="text-base font-bold">Late Check-In Notifications</Label>
                   <p className="text-sm text-muted-foreground">Send when an employee is marked as Late.</p>
                </div>
                <Switch 
                   checked={settings?.send_late || false} 
                   onCheckedChange={(c) => updateSetting('send_late', c)} 
                   disabled={saving || !settings?.is_enabled}
                />
             </div>

             <div className="flex items-center justify-between pt-4 border-t">
                <div>
                   <Label className="text-base font-bold">Early Check-Out Notifications</Label>
                   <p className="text-sm text-muted-foreground">Send when an employee leaves before office end time.</p>
                </div>
                <Switch 
                   checked={settings?.send_early || false} 
                   onCheckedChange={(c) => updateSetting('send_early', c)} 
                   disabled={saving || !settings?.is_enabled}
                />
             </div>
          </div>
        </GlassCard>

        <div className="space-y-6">
          <GlassCard className="p-6">
            <div className="flex items-center gap-3 mb-6 border-b pb-4">
              <div className="p-3 rounded-xl bg-primary/10 text-primary">
                <Settings className="size-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Connection Details</h2>
                <p className="text-sm text-muted-foreground">Configured via environment variables for security.</p>
              </div>
            </div>

            <div className="space-y-4">
               <div>
                 <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Provider</Label>
                 <div className="font-medium">{settings?.provider === 'cloud_api' ? 'WhatsApp Business Platform (Cloud API)' : 'Other'}</div>
               </div>
               <div>
                 <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Status</Label>
                 <div className="flex items-center gap-2 mt-1">
                   <div className={`size-2.5 rounded-full ${settings?.is_enabled ? 'bg-green-500' : 'bg-red-500'}`} />
                   <span className="font-bold">{settings?.is_enabled ? 'Connected' : 'Not Connected'}</span>
                 </div>
               </div>
               <div className="p-4 bg-muted/30 rounded-xl text-sm text-muted-foreground">
                 Note: Sensitive API credentials (Tokens, Phone Number IDs) are stored securely in environment variables (e.g. WHATSAPP_ACCESS_TOKEN) and are not exposed to the frontend.
               </div>
            </div>
          </GlassCard>

          <GlassCard className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-xl bg-blue-500/10 text-blue-500">
                <Send className="size-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Test Connection</h2>
                <p className="text-sm text-muted-foreground">Send a test message</p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <Input 
                placeholder="Enter WhatsApp Number (e.g. +9779812345678)" 
                value={testNumber} 
                onChange={(e) => setTestNumber(e.target.value)} 
                className="rounded-xl"
              />
              <Button onClick={handleTest} disabled={testing || !testNumber} className="rounded-xl font-bold">
                {testing ? "Sending..." : "Send Test"}
              </Button>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

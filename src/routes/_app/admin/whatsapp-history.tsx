import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { formatNepaliDate } from "@/lib/nepali-calendar";
import { RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_app/admin/whatsapp-history")({ component: WhatsAppHistory });

function WhatsAppHistory() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    // Fetch logs and join with profiles to get employee name
    const { data, error } = await supabase
      .from("whatsapp_notifications")
      .select("*, profiles(full_name, avatar_url)")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      toast.error(error.message);
    } else {
      setLogs(data || []);
    }
    setLoading(false);
  };

  const getStatusColor = (status: string) => {
    switch(status) {
        case 'DELIVERED':
        case 'READ':
        case 'SENT': return 'bg-green-500/10 text-green-600';
        case 'FAILED': return 'bg-red-500/10 text-red-600';
        case 'PENDING':
        case 'PROCESSING': return 'bg-amber-500/10 text-amber-600';
        default: return 'bg-gray-500/10 text-gray-600';
    }
  };

  const getNotificationLabel = (type: string) => {
      switch(type) {
          case 'ATTENDANCE_CHECK_IN': return 'Check-In';
          case 'ATTENDANCE_CHECK_OUT': return 'Check-Out';
          case 'ATTENDANCE_LATE': return 'Late Check-In';
          case 'ATTENDANCE_EARLY_CHECKOUT': return 'Early Check-Out';
          case 'TEST_MESSAGE': return 'Test Message';
          default: return type;
      }
  };

  const filteredLogs = logs.filter(l => 
    (l.profiles?.full_name?.toLowerCase().includes(search.toLowerCase())) ||
    (l.recipient_number?.includes(search)) ||
    (l.notification_type?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <PageHeader title="WhatsApp Notification History" subtitle="View delivery status of automated messages" />
          <div className="flex items-center gap-3">
             <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input 
                  placeholder="Search name, number, type..." 
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 w-[250px] rounded-xl"
                />
             </div>
             <Button variant="outline" size="icon" onClick={fetchLogs} disabled={loading} className="rounded-xl">
                 <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
             </Button>
          </div>
      </div>

      <GlassCard className="p-0 overflow-hidden">
         <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b bg-muted/20 text-muted-foreground text-xs uppercase tracking-wider">
                        <th className="font-bold text-left p-4">Date & Time</th>
                        <th className="font-bold text-left p-4">Employee</th>
                        <th className="font-bold text-left p-4">Phone Number</th>
                        <th className="font-bold text-left p-4">Notification</th>
                        <th className="font-bold text-center p-4">Status</th>
                        <th className="font-bold text-center p-4">Attempts</th>
                        <th className="font-bold text-left p-4">Error</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                    {filteredLogs.map(log => (
                        <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                            <td className="p-4 whitespace-nowrap">
                                <div className="font-medium">{formatNepaliDate(log.created_at, "DD MMM YYYY")}</div>
                                <div className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleTimeString()}</div>
                            </td>
                            <td className="p-4 font-medium">
                                {log.profiles?.full_name || "Unknown / Test"}
                            </td>
                            <td className="p-4 text-muted-foreground">
                                {log.recipient_number}
                            </td>
                            <td className="p-4 font-medium">
                                {getNotificationLabel(log.notification_type)}
                            </td>
                            <td className="p-4 text-center">
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${getStatusColor(log.status)}`}>
                                    {log.status}
                                </span>
                            </td>
                            <td className="p-4 text-center text-muted-foreground">
                                {log.attempt_count}
                            </td>
                            <td className="p-4 text-xs text-red-500 max-w-[200px] truncate" title={log.error_message}>
                                {log.error_message || "-"}
                            </td>
                        </tr>
                    ))}
                    {filteredLogs.length === 0 && (
                        <tr>
                            <td colSpan={7} className="p-12 text-center text-muted-foreground">
                                {loading ? "Loading logs..." : "No notification logs found."}
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
         </div>
      </GlassCard>
    </div>
  );
}

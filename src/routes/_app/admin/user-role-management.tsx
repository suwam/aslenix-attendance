import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ShieldCheck, UserPlus, Loader2, ShieldOff, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { AccessDenied } from "@/components/AccessDenied";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/admin/user-role-management")({ component: UserRoleManagementPage });

const modules = [
  ["employees", ["view", "create", "edit", "delete", "export"]],
  ["attendance", ["view", "edit", "approve", "export"]],
  ["leaves", ["view", "edit", "approve", "export"]],
  ["shifts", ["view", "create", "edit", "delete"]],
  ["reports", ["view", "export"]],
  ["meetings", ["view", "create", "edit", "delete"]],
] as const;
const actions = ["view", "create", "edit", "delete", "approve", "export"] as const;
type HrAccount = { user_id: string; full_name: string; email: string; department: string | null; approval_status: string; is_suspended: boolean; permission_count: number; created_at: string };
type CatalogPermission = { permission_key: string; module: string; action: string };

const DEFAULT_CATALOG: CatalogPermission[] = modules.flatMap(([mod, acts]) =>
  acts.map((act) => ({
    permission_key: `${mod}.${act}`,
    module: mod,
    action: act,
  }))
);

function isSchemaMissing(error: any) {
  if (!error) return false;
  const msg = String(error.message || "");
  const code = String(error.code || "");
  return (
    code === "PGRST202" ||
    code === "PGRST205" ||
    code === "42P01" ||
    code === "42883" ||
    msg.includes("schema cache") ||
    msg.includes("does not exist")
  );
}

function UserRoleManagementPage() {
  const { isSuperAdmin } = useAuth();
  const [accounts, setAccounts] = useState<HrAccount[]>([]);
  const [catalog, setCatalog] = useState<CatalogPermission[]>(DEFAULT_CATALOG);
  const [selected, setSelected] = useState<HrAccount | null>(null);
  const [assigned, setAssigned] = useState<Set<string>>(new Set());
  const [original, setOriginal] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [grantOpen, setGrantOpen] = useState(false);
  const [candidates, setCandidates] = useState<{ user_id: string; full_name: string; email: string }[]>([]);
  const [candidateId, setCandidateId] = useState("");
  const [logs, setLogs] = useState<any[]>([]);
  const [migrationNeeded, setMigrationNeeded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [accountResult, catalogResult, profilesResult, logResult] = await Promise.all([
      (supabase as any).rpc("rbac_list_hr_accounts"),
      (supabase as any).from("permissions").select("permission_key,module,action").order("module"),
      supabase.from("profiles").select("user_id,full_name,email,approval_status,is_suspended,department,user_roles(role)").order("full_name"),
      (supabase as any).from("admin_activity_logs").select("*").order("created_at", { ascending: false }).limit(30),
    ]);

    const missing = isSchemaMissing(accountResult.error) || isSchemaMissing(catalogResult.error);
    setMigrationNeeded(missing);

    if (accountResult.error && !missing) {
      toast.error("Could not load role management data.");
    }

    if (accountResult.data) {
      setAccounts((accountResult.data ?? []) as HrAccount[]);
    } else if (profilesResult.data) {
      // Graceful fallback: show existing hr_manager accounts from profiles & user_roles
      const fallbackHr = (profilesResult.data as any[])
        .filter((profile: any) => (profile.user_roles ?? []).some((role: any) => role.role === "hr_manager"))
        .map((p: any) => ({
          user_id: p.user_id,
          full_name: p.full_name || "HR Member",
          email: p.email || "",
          department: p.department || null,
          approval_status: p.approval_status || "approved",
          is_suspended: !!p.is_suspended,
          permission_count: 0,
          created_at: new Date().toISOString(),
        }));
      setAccounts(fallbackHr);
    } else {
      setAccounts([]);
    }

    setCatalog(
      catalogResult.data && (catalogResult.data as any[]).length > 0
        ? (catalogResult.data as CatalogPermission[])
        : DEFAULT_CATALOG
    );

    setCandidates(
      (profilesResult.data ?? [])
        .filter((profile: any) => !(profile.user_roles ?? []).some((role: any) => role.role === "admin" || role.role === "super_admin"))
        .map((p: any) => ({ user_id: p.user_id, full_name: p.full_name || "Employee", email: p.email || "" }))
    );

    setLogs(logResult.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { if (isSuperAdmin) void load(); }, [isSuperAdmin, load]);

  const selectAccount = async (account: HrAccount) => {
    setSelected(account);
    const { data, error } = await (supabase as any)
      .from("user_permissions")
      .select("permissions(permission_key)")
      .eq("user_id", account.user_id);
    if (error) {
      if (isSchemaMissing(error)) {
        setAssigned(new Set());
        setOriginal(new Set());
        return;
      }
      return toast.error("Could not load this account's permissions.");
    }
    const keys = new Set<string>((data ?? []).map((row: any) => row.permissions?.permission_key).filter((key: unknown): key is string => typeof key === "string"));
    setAssigned(keys); setOriginal(new Set(keys));
  };

  const toggle = (key: string) => setAssigned((current) => {
    const next = new Set(current); next.has(key) ? next.delete(key) : next.add(key); return next;
  });
  const dirty = useMemo(() => [...assigned].sort().join("|") !== [...original].sort().join("|"), [assigned, original]);

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    const { error } = await (supabase as any).rpc("rbac_set_hr_permissions", { p_user_id: selected.user_id, p_permission_keys: [...assigned] });
    setSaving(false);
    if (error) {
      if (isSchemaMissing(error)) {
        return toast.error("Database migration required: please run 20261126000100_custom_hr_rbac.sql in Supabase SQL editor first.");
      }
      return toast.error(error.message || "Permission update was rejected.");
    }
    setOriginal(new Set(assigned)); toast.success("Permissions saved."); void load();
  };
  const setAccess = async (account: HrAccount, enabled: boolean) => {
    if (!enabled && !window.confirm(`Revoke all HR access for ${account.full_name}?`)) return;
    const { error } = await (supabase as any).rpc("rbac_set_hr_access", { p_user_id: account.user_id, p_enabled: enabled });
    if (error) {
      if (isSchemaMissing(error)) {
        return toast.error("Database migration required: please run 20261126000100_custom_hr_rbac.sql in Supabase SQL editor first.");
      }
      return toast.error(error.message || "Access change was rejected.");
    }
    toast.success(enabled ? "HR access granted." : "HR access revoked.");
    if (!enabled && selected?.user_id === account.user_id) setSelected(null);
    void load();
  };
  const setSuspension = async (account: HrAccount, suspended: boolean) => {
    if (suspended && !window.confirm(`Suspend HR access for ${account.full_name}?`)) return;
    const { error } = await (supabase as any).rpc("rbac_set_hr_suspension", { p_user_id: account.user_id, p_suspended: suspended });
    if (error) {
      if (isSchemaMissing(error)) {
        return toast.error("Database migration required: please run 20261126000100_custom_hr_rbac.sql in Supabase SQL editor first.");
      }
      return toast.error(error.message || "Account status change was rejected.");
    }
    toast.success(suspended ? "HR account suspended." : "HR account activated.");
    void load();
  };
  const grant = async () => {
    if (!candidateId) return;
    // Grant HR access to the selected candidate
    await setAccess({ user_id: candidateId, full_name: "Selected employee" } as HrAccount, true);
    // Refresh the Supabase session so the new role is reflected without logout
    try {
      await supabase.auth.refreshSession();
      toast.success("Session refreshed – HR role applied.");
    } catch (e) {
      console.error("Failed to refresh session", e);
      toast.error("Could not refresh session; please reload the page.");
    }
    setGrantOpen(false);
    setCandidateId("");
  };

  if (!isSuperAdmin) return <AccessDenied />;

  return (
    <>
      <PageHeader
        title="User & Role Management"
        subtitle="Grant HR access and assign only the permissions each HR account needs."
        actions={
          <Button
            onClick={() => setGrantOpen(true)}
            className="h-10 rounded-xl px-5 font-bold text-xs sm:text-sm bg-gradient-to-r from-[#c4daff] via-[#d5d3ff] to-[#e5ccff] text-[#0f172a] shadow-xs hover:brightness-105 active:scale-[0.98] transition-all flex items-center border-0 cursor-pointer"
          >
            <UserPlus size={16} className="mr-2" />
            Grant HR access
          </Button>
        }
      />

      {migrationNeeded && (
        <div className="mb-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-foreground flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1">
            <div className="font-bold text-sm text-foreground flex items-center gap-2">
              Database Migration Required
              <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-300 text-[10px]">
                Run in Supabase SQL Editor
              </Badge>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              The custom HR RBAC database tables and functions have not been executed on your Supabase project yet. To enable saving granular permissions and audit logs, please run the SQL script in your Supabase SQL Editor:
            </p>
            <div className="mt-2 font-mono text-[11px] bg-background/80 p-2 rounded-lg border border-border select-all">
              supabase/migrations/20261126000100_custom_hr_rbac.sql
            </div>
          </div>
        </div>
      )}

      <Tabs defaultValue="accounts" className="space-y-5">
        <TabsList>
          <TabsTrigger value="accounts">HR Accounts</TabsTrigger>
          <TabsTrigger value="permissions" disabled={!selected}>
            Permission Editor {selected ? `(${selected.full_name})` : ""}
          </TabsTrigger>
          <TabsTrigger value="activity">Activity Logs</TabsTrigger>
        </TabsList>
        <TabsContent value="accounts" className="rounded-2xl border bg-card overflow-hidden">
          {loading ? (
            <div className="p-10 text-center">
              <Loader2 className="mx-auto animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-left text-muted-foreground">
                  <tr>
                    <th className="p-4">Employee</th>
                    <th>Department</th>
                    <th>Status</th>
                    <th>Permissions</th>
                    <th>Created</th>
                    <th className="p-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((account) => (
                    <tr key={account.user_id} className="border-b last:border-0">
                      <td className="p-4">
                        <div className="font-medium">{account.full_name}</div>
                        <div className="text-xs text-muted-foreground">{account.email}</div>
                      </td>
                      <td>{account.department || "—"}</td>
                      <td>
                        <Badge variant={account.is_suspended ? "destructive" : "secondary"}>
                          {account.is_suspended ? "Suspended" : account.approval_status}
                        </Badge>
                      </td>
                      <td>{account.permission_count}</td>
                      <td>{new Date(account.created_at).toLocaleDateString()}</td>
                      <td className="p-4 flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => void selectAccount(account)}>
                          Permissions
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void setSuspension(account, !account.is_suspended)}
                        >
                          {account.is_suspended ? "Activate" : "Suspend"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => void setAccess(account, false)}
                        >
                          <ShieldOff size={15} className="mr-1" />
                          Revoke
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {accounts.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-10 text-center text-muted-foreground">
                        No HR accounts have been granted access yet. Click &quot;Grant HR access&quot; above to add one.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
        <TabsContent value="permissions" className="space-y-4">
          {selected && (
            <div className="rounded-2xl border bg-card p-5">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{selected.full_name}</h2>
                  <p className="text-sm text-muted-foreground">
                    Changes take effect after save and are audited.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setAssigned(new Set())}>
                    Clear all
                  </Button>
                  <Button variant="outline" disabled={!dirty} onClick={() => setAssigned(new Set(original))}>
                    Cancel
                  </Button>
                  <Button disabled={!dirty || saving} onClick={() => void save()}>
                    {saving && <Loader2 className="mr-2 size-4 animate-spin" />}Save changes
                  </Button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[650px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="p-3">Module</th>
                      {actions.map((action) => (
                        <th key={action} className="p-3 text-center capitalize">
                          {action}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {modules.map(([module, available]) => (
                      <tr key={module} className="border-b">
                        <td className="p-3 font-medium capitalize">{module}</td>
                        {actions.map((action) => {
                          const key = `${module}.${action}`;
                          const exists = available.includes(action as never) && catalog.some((p) => p.permission_key === key);
                          return (
                            <td key={action} className="p-3 text-center">
                              {exists ? (
                                <Switch
                                  checked={assigned.has(key)}
                                  onCheckedChange={() => toggle(key)}
                                  aria-label={key}
                                />
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>
        <TabsContent value="activity" className="rounded-2xl border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-muted-foreground">
                <tr>
                  <th className="p-4">Action</th>
                  <th>Module</th>
                  <th>Target</th>
                  <th className="p-4">When</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr className="border-b" key={log.id}>
                    <td className="p-4">{log.action}</td>
                    <td>{log.module}</td>
                    <td>{log.target_user_id || log.target_record_id || "—"}</td>
                    <td className="p-4">{new Date(log.created_at).toLocaleString()}</td>
                  </tr>
                ))}
                {!logs.length && (
                  <tr>
                    <td colSpan={4} className="p-10 text-center text-muted-foreground">
                      No logged HR operations yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
      <Dialog open={grantOpen} onOpenChange={setGrantOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grant HR access</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Select an existing employee account. New HR accounts start with no permissions.
          </p>
          <Select value={candidateId} onValueChange={setCandidateId} disabled={candidates.filter((candidate) => !accounts.some((account) => account.user_id === candidate.user_id)).length === 0}>
  <SelectTrigger>
    <SelectValue placeholder={candidates.filter((candidate) => !accounts.some((account) => account.user_id === candidate.user_id)).length === 0 ? "No employees available" : "Select employee"} />
  </SelectTrigger>
  <SelectContent>
    {candidates
      .filter((candidate) => !accounts.some((account) => account.user_id === candidate.user_id))
      .map((candidate) => (
        <SelectItem key={candidate.user_id} value={candidate.user_id}>
          {candidate.full_name} — {candidate.email}
        </SelectItem>
      ))}
  </SelectContent>
</Select>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGrantOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!candidateId} onClick={() => void grant()}>
              <ShieldCheck size={16} className="mr-2" />
              Grant access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

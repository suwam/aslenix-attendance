import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "super_admin" | "admin" | "hr_manager" | "employee" | "viewer" | "team_lead";
export type PermissionAction = "view" | "create" | "edit" | "delete" | "approve" | "export";
export type PermissionKey = `${string}.${PermissionAction}`;
export type ApprovalStatus = "pending" | "approved" | "rejected" | "suspended";

export interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  department: string | null;
  position: string | null;
  address: string | null;
  avatar_url: string | null;
  blood_group: string | null;
  emergency_contact: string | null;
  joining_date: string | null;
  employee_code: string | null;
  approval_status: ApprovalStatus;
  is_eom_eligible: boolean;
  is_suspended: boolean;
  qr_token: string | null;
  qr_status: "active" | "inactive" | "revoked";
}

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  permissions: string[];
  loading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isHR: boolean;
  isTeamLead: boolean;
  isApproved: boolean;
  hasRole: (role: AppRole) => boolean;
  hasPermission: (permission: PermissionKey | string) => boolean;
  canView: (module: string) => boolean;
  canCreate: (module: string) => boolean;
  canEdit: (module: string) => boolean;
  canDelete: (module: string) => boolean;
  canApprove: (module: string) => boolean;
  canExport: (module: string) => boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (uid: string) => {
    setLoading(true);
    try {
      const [p, r, assigned] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", uid).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", uid),
        (supabase as any)
          .from("user_permissions")
          .select("permissions(permission_key)")
          .eq("user_id", uid),
      ]);
      if (p.error) console.error("Failed to load profile", p.error);
      if (r.error) console.error("Failed to load user roles", r.error);
      if (assigned.error) console.error("Failed to load user permissions", assigned.error);
      setProfile((p.data as Profile) ?? null);
      setRoles(((r.data ?? []) as { role: AppRole }[]).map((x) => x.role));
      setPermissions(
        (assigned.data ?? [])
          .map((row: { permissions?: { permission_key?: string } | null }) => row.permissions?.permission_key)
          .filter((key: string | undefined): key is string => Boolean(key)),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (user) await loadProfile(user.id);
  }, [user, loadProfile]);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        loadProfile(s.user.id);
      } else {
        setProfile(null);
        setRoles([]);
        setPermissions([]);
      }
    });
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) loadProfile(s.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  // A permission revocation must take effect without requiring the HR user to sign out.
  useEffect(() => {
    if (!user) return;
    const refreshAuthorization = () => void loadProfile(user.id);
    const channel = supabase
      .channel(`authorization-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles", filter: `user_id=eq.${user.id}` }, refreshAuthorization)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_permissions", filter: `user_id=eq.${user.id}` }, refreshAuthorization)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles", filter: `user_id=eq.${user.id}` }, refreshAuthorization)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, loadProfile]);

  const isSuperAdmin = roles.includes("super_admin");
  const isAdmin = isSuperAdmin || roles.includes("admin");
  const isHR = roles.includes("hr_manager");
  const isTeamLead = roles.some((r) => r === "team_lead");
  const isApproved = profile?.approval_status === "approved" && !profile?.is_suspended;
  const hasRole = useCallback((role: AppRole) => roles.includes(role), [roles]);
  const hasPermission = useCallback(
    (permission: PermissionKey | string) => isAdmin || permissions.includes(permission),
    [isAdmin, permissions],
  );
  const canView = useCallback((module: string) => hasPermission(`${module}.view`), [hasPermission]);
  const canCreate = useCallback((module: string) => hasPermission(`${module}.create`), [hasPermission]);
  const canEdit = useCallback((module: string) => hasPermission(`${module}.edit`), [hasPermission]);
  const canDelete = useCallback((module: string) => hasPermission(`${module}.delete`), [hasPermission]);
  const canApprove = useCallback((module: string) => hasPermission(`${module}.approve`), [hasPermission]);
  const canExport = useCallback((module: string) => hasPermission(`${module}.export`), [hasPermission]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setRoles([]);
    setPermissions([]);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        roles,
        permissions,
        loading,
        isAdmin,
        isSuperAdmin,
        isHR,
        isTeamLead,
        isApproved,
        hasRole,
        hasPermission,
        canView,
        canCreate,
        canEdit,
        canDelete,
        canApprove,
        canExport,
        refresh,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

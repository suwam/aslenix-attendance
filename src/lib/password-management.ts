import { supabase } from "@/integrations/supabase/client";

export interface PasswordResetLog {
  id: string;
  created_at: string;
  details: {
    admin_id?: string;
    target_user_id?: string;
    target_email?: string;
    target_name?: string;
    timestamp?: string;
    status?: string;
    outcome?: string;
  } | null;
}

/**
 * Generates a strong, memorable, and secure password satisfying standard complexity rules:
 * Uppercase, lowercase, numbers, and symbols.
 */
export function generateSecurePassword(): string {
  const adjectives = ["Apex", "Swift", "Nova", "Titan", "Zenith", "Quantum", "Nexus", "Cobalt"];
  const nouns = ["Shield", "Vector", "Pulse", "Forge", "Beacon", "Matrix", "Falcon", "Orbit"];
  const symbols = ["@", "#", "$", "!", "%", "&", "*"];

  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const symbol = symbols[Math.floor(Math.random() * symbols.length)];
  const year = new Date().getFullYear();
  const randomSuffix = Math.floor(10 + Math.random() * 90);

  return `${adj}${noun}${symbol}${year}#${randomSuffix}`;
}

/**
 * Resets an employee's password as an Administrator.
 * Attempts Supabase Edge Function first, and automatically falls back to database RPC.
 */
export async function adminResetEmployeePassword(
  targetUserId: string,
  newPassword: string
): Promise<{ success: boolean; message: string; method: "edge_function" | "rpc" }> {
  if (!targetUserId) {
    throw new Error("Target employee user ID is required.");
  }

  if (!newPassword || newPassword.length < 6) {
    throw new Error("Password must be at least 6 characters long.");
  }

  // 1. Attempt using Supabase Edge Function (Admin Auth API)
  try {
    const { data: fnData, error: fnError } = await supabase.functions.invoke("admin-reset-password", {
      body: { targetUserId, newPassword },
    });

    if (!fnError && fnData && !fnData.error) {
      return {
        success: true,
        message: fnData.message || "Password reset successfully",
        method: "edge_function",
      };
    }
  } catch (err) {
    console.warn("Edge function invocation failed, falling back to database RPC:", err);
  }

  // 2. Fallback to PostgreSQL security-definer RPC
  const { data: rpcData, error: rpcError } = await (supabase as any).rpc(
    "admin_reset_user_password",
    {
      p_target_user_id: targetUserId,
      p_new_password: newPassword,
    }
  );

  if (rpcError) {
    throw new Error(rpcError.message || "Failed to reset employee password.");
  }

  const message =
    (rpcData && typeof rpcData === "object" && (rpcData as any).message) ||
    "Password reset successfully.";

  return {
    success: true,
    message,
    method: "rpc",
  };
}

/**
 * Updates the authenticated user's own password.
 */
export async function changeOwnPassword(newPassword: string): Promise<void> {
  if (!newPassword || newPassword.length < 6) {
    throw new Error("Password must be at least 6 characters long.");
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Fetches recent password reset audit logs from activity_logs.
 */
export async function fetchRecentPasswordResets(limit = 10): Promise<PasswordResetLog[]> {
  try {
    const { data, error } = await supabase
      .from("activity_logs")
      .select("id, created_at, details")
      .eq("action", "admin_password_reset")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Error fetching password reset logs:", error);
      return [];
    }

    return (data || []) as PasswordResetLog[];
  } catch (err) {
    console.error("Failed to load activity logs:", err);
    return [];
  }
}

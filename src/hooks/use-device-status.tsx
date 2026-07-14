import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { startRegistration } from "@simplewebauthn/browser";
import {
  getBrowserAndOS,
  getTrustedDeviceFingerprint,
  logTrustedDeviceEvent,
} from "@/lib/trusted-devices";

export { getBrowserAndOS };

export type DeviceStatus = "loading" | "registered" | "pending" | "rejected" | "inactive" | "unregistered" | "setup_required";

export type RegisteredDevice = {
  id: string;
  device_name: string;
  device_fingerprint: string;
  browser: string;
  operating_system: string;
  status: "Active" | "Inactive";
  registered_at: string;
  last_login: string;
  force_logout_at?: string | null;
};

export function useDeviceStatus() {
  const { user, isAdmin } = useAuth();
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>(isAdmin ? "registered" : "loading");
  const [localFingerprint, setLocalFingerprint] = useState("");
  const [registeredDevices, setRegisteredDevices] = useState<RegisteredDevice[]>([]);
  const [maxRegisteredDevices, setMaxRegisteredDevices] = useState(2);
  const [pendingReq, setPendingReq] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);

  const invokeWebAuthn = async <T,>(action: string, payload: Record<string, unknown>): Promise<T> => {
    const { data, error } = await supabase.functions.invoke("webauthn", {
      body: { action, payload },
    });

    if (error) {
      throw new Error(error.message || "Biometric request failed");
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    return data as T;
  };

  useEffect(() => {
    if (user) {
      checkDevice();
    }

    const handleForceCheck = () => {
      if (user) checkDevice();
    };
    
    window.addEventListener("force-device-check", handleForceCheck);
    return () => window.removeEventListener("force-device-check", handleForceCheck);
  }, [user]);

  const checkDevice = async () => {
    if (!user) return;
    if (isAdmin) {
      setDeviceStatus("registered");
      return;
    }
    
    const fingerprint = await getTrustedDeviceFingerprint();
    setLocalFingerprint(fingerprint);

    const [{ data: currentDevice }, { data: activeDevices }, { data: settings }] = await Promise.all([
      supabase
      .from("employee_devices")
      .select("*")
      .eq("employee_id", user.id)
      .eq("device_fingerprint", fingerprint)
        .maybeSingle(),
      (supabase as any)
        .from("employee_devices")
        .select("id,device_name,device_fingerprint,browser,operating_system,status,registered_at,last_login,force_logout_at")
        .eq("employee_id", user.id)
        .eq("status", "Active")
        .order("last_login", { ascending: false }),
      (supabase as any)
        .from("device_security_settings")
        .select("max_trusted_devices")
        .eq("id", true)
        .maybeSingle(),
    ]);

    const devices = (activeDevices ?? []) as RegisteredDevice[];
    const maxDevices = Number(settings?.max_trusted_devices ?? 2);
    setRegisteredDevices(devices);
    setMaxRegisteredDevices(maxDevices);

    if (currentDevice) {
      if (currentDevice.status === "Active" && !currentDevice.force_logout_at) {
        await (supabase as any)
          .from("employee_devices")
          .update({ last_login: new Date().toISOString() })
          .eq("id", currentDevice.id);
        setDeviceStatus("registered");
      } else {
        setDeviceStatus("inactive");
      }
      return;
    }

    const { data: request } = await supabase
      .from("pending_device_requests")
      .select("*")
      .eq("employee_id", user.id)
      .eq("device_fingerprint", fingerprint)
      .order("requested_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (request) {
      setPendingReq(request);
      if (request.status === "Pending") {
        setDeviceStatus("pending");
        return;
      }
      if (request.status === "Approved") {
        setDeviceStatus("setup_required");
        return;
      }
      if (request.status === "Rejected") {
        setDeviceStatus("rejected");
        return;
      }
    }

    // Auto-register logic (requires passkey setup first)
    if (devices.length < maxDevices) {
      setDeviceStatus("setup_required");
      return;
    }

    // If at limit and no pending/rejected request exists, auto-request
    if (devices.length >= maxDevices && (!request || request.status === "Approved")) {
      const { browser, os } = getBrowserAndOS();
      const name = `${os} ${browser}`;
      const { error } = await (supabase as any)
        .from("pending_device_requests")
        .insert({
          employee_id: user.id,
          device_fingerprint: fingerprint,
          browser,
          operating_system: os,
          device_name: name,
          status: "Pending",
        });

      if (!error) {
        await logTrustedDeviceEvent({
          employeeId: user.id,
          deviceFingerprint: fingerprint,
          action: "registration_requested",
          actorRole: "system",
          metadata: { browser, os, deviceName: name },
        });
        setDeviceStatus("pending");
        return;
      }
    }

    setDeviceStatus("unregistered");
  };

  const setupBiometrics = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const rpID = window.location.hostname;
      const username = user.user_metadata?.full_name || user.email || "Employee";

      // 1. Get registration options from WebAuthn endpoint
      const { options } = await invokeWebAuthn<{ options: any }>("generate-registration-options", {
        userId: user.id,
        deviceFingerprint: localFingerprint,
        rpID,
        username,
      });

      // 2. Prompt user OS for Passkey
      const attResp = await startRegistration({ optionsJSON: options });

      // 3. Verify response with WebAuthn endpoint
      const verificationResp = await invokeWebAuthn<{ verified: boolean }>("verify-registration-response", {
        userId: user.id,
        deviceFingerprint: localFingerprint,
        rpID,
        response: attResp,
      });

      if (verificationResp.verified) {
        // 4. Successful passkey registration -> Now save to employee_devices
        const { browser, os } = getBrowserAndOS();
        const nameToUse = pendingReq?.device_name || `${os} ${browser}`;
        const now = new Date().toISOString();
        const replaceDeviceId = pendingReq?.replace_device_id;

        // If replacing an existing device
        if (replaceDeviceId) {
          const replacedDevice = registeredDevices.find((device) => device.id === replaceDeviceId);
          const { error: replaceError } = await (supabase as any)
            .from("employee_devices")
            .update({
              status: "Inactive",
              removed_at: now,
              removed_by: user.id,
              removal_reason: "Replaced by employee registered device",
            })
            .eq("id", replaceDeviceId)
            .eq("employee_id", user.id);
          if (replaceError) throw replaceError;

          if (replacedDevice) {
            await (supabase as any)
              .from("device_passkeys")
              .delete()
              .eq("employee_id", user.id)
              .eq("device_fingerprint", replacedDevice.device_fingerprint);
          }
        }

        // Insert new device
        const { data: device, error } = await (supabase as any)
          .from("employee_devices")
          .upsert(
            {
              employee_id: user.id,
              device_fingerprint: localFingerprint,
              browser,
              operating_system: os,
              device_name: nameToUse,
              status: "Active",
              last_login: now,
            },
            { onConflict: "employee_id,device_fingerprint" },
          )
          .select("id,device_name,device_fingerprint,browser,operating_system,status,registered_at,last_login,force_logout_at")
          .single();
        if (error) throw error;

        // Clean up pending request if we had one
        if (pendingReq) {
          await (supabase as any)
            .from("pending_device_requests")
            .update({ status: "Registered" }) // Mark as registered so it doesn't stay 'Approved'
            .eq("id", pendingReq.id);
        }

        await logTrustedDeviceEvent({
          employeeId: user.id,
          deviceId: device.id,
          deviceFingerprint: localFingerprint,
          action: replaceDeviceId ? "replaced" : "passkey_registered",
          metadata: { browser, os, deviceName: nameToUse, replaceDeviceId: replaceDeviceId ?? null },
        });

        toast.success("Device and Passkey registered successfully!");
        await checkDevice();
      } else {
        toast.error("Biometric setup failed verification.");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to setup biometrics");
    } finally {
      setBusy(false);
    }
  };

  return {
    deviceStatus,
    localFingerprint,
    registeredDevices,
    maxRegisteredDevices,
    busy,
    setupBiometrics,
    checkDevice,
  };
}

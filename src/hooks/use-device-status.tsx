import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import {
  getBrowserAndOS,
  getTrustedDeviceFingerprint,
  logTrustedDeviceEvent,
} from "@/lib/trusted-devices";

export { getBrowserAndOS };

export type DeviceStatus = "loading" | "unregistered" | "pending" | "approved" | "inactive" | "setup_biometrics" | "replace_required";

export type TrustedDevice = {
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
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>(isAdmin ? "approved" : "loading");
  const [pendingReq, setPendingReq] = useState<any | null>(null);
  const [localFingerprint, setLocalFingerprint] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [trustedDevices, setTrustedDevices] = useState<TrustedDevice[]>([]);
  const [maxTrustedDevices, setMaxTrustedDevices] = useState(2);
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
  }, [user]);

  const checkDevice = async () => {
    if (!user) return;
    if (isAdmin) {
      setDeviceStatus("approved");
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

    const devices = (activeDevices ?? []) as TrustedDevice[];
    const maxDevices = Number(settings?.max_trusted_devices ?? 2);
    setTrustedDevices(devices);
    setMaxTrustedDevices(maxDevices);

    if (currentDevice) {
      if (currentDevice.status === "Active" && !currentDevice.force_logout_at) {
        await (supabase as any)
          .from("employee_devices")
          .update({ last_login: new Date().toISOString() })
          .eq("id", currentDevice.id);
        setDeviceStatus("approved");
      } else {
        setDeviceStatus("inactive");
      }
      return;
    }

    if (devices.length === 0) {
      const { browser, os } = getBrowserAndOS();
      const name = deviceName.trim() || `${os} ${browser}`;
      const { data: inserted, error } = await (supabase as any)
        .from("employee_devices")
        .insert({
          employee_id: user.id,
          device_fingerprint: fingerprint,
          browser,
          operating_system: os,
          device_name: name,
          status: "Active",
        })
        .select("id,device_name,device_fingerprint,browser,operating_system,status,registered_at,last_login,force_logout_at")
        .single();

      if (error) {
        toast.error(error.message);
        setDeviceStatus("unregistered");
        return;
      }

      await logTrustedDeviceEvent({
        employeeId: user.id,
        deviceId: inserted.id,
        deviceFingerprint: fingerprint,
        actorRole: "system",
        action: "auto_registered",
        metadata: { browser, os, deviceName: name },
      });

      setTrustedDevices([inserted as TrustedDevice]);
      setDeviceName(name);
      setDeviceStatus("approved");
      return;
    }

    const { data: requests } = await supabase
      .from("pending_device_requests")
      .select("*")
      .eq("employee_id", user.id)
      .eq("device_fingerprint", fingerprint)
      .eq("status", "Pending")
      .maybeSingle();

    if (requests) {
      setDeviceStatus("pending");
      setPendingReq(requests);
    } else if (devices.length >= maxDevices) {
      setDeviceStatus("replace_required");
    } else {
      setDeviceStatus("unregistered");
    }
  };

  const setupBiometrics = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const rpID = window.location.hostname;
      const username = user.user_metadata?.full_name || user.email || "Employee";

      const { options } = await invokeWebAuthn<{ options: any }>("generate-registration-options", {
        userId: user.id,
        deviceFingerprint: localFingerprint,
        rpID,
        username,
      });

      const attResp = await startRegistration({ optionsJSON: options });

      const verificationResp = await invokeWebAuthn<{ verified: boolean }>("verify-registration-response", {
        userId: user.id,
        deviceFingerprint: localFingerprint,
        rpID,
        response: attResp,
      });

      if (verificationResp.verified) {
        await logTrustedDeviceEvent({
          employeeId: user.id,
          deviceFingerprint: localFingerprint,
          action: "passkey_registered",
        });
        toast.success("Biometrics setup successfully!");
        setDeviceStatus("approved");
      } else {
        toast.error("Biometric setup failed.");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to setup biometrics");
    } finally {
      setBusy(false);
    }
  };

  const verifyBiometrics = async (): Promise<boolean> => {
    if (!user) return false;
    if (isAdmin) return true;
    if (deviceStatus !== "approved") {
      toast.error(
        deviceStatus === "setup_biometrics" 
          ? "Please setup your Passkey first from the Trusted Devices page."
          : "You must use an approved Trusted Device to check in."
      );
      return false;
    }
    try {
      const rpID = window.location.hostname;
      
      const { options } = await invokeWebAuthn<{ options: any }>("generate-authentication-options", {
        userId: user.id,
        deviceFingerprint: localFingerprint,
        rpID,
      });

      const asseResp = await startAuthentication({ optionsJSON: options });

      const verificationResp = await invokeWebAuthn<{ verified: boolean }>("verify-authentication-response", {
        userId: user.id,
        deviceFingerprint: localFingerprint,
        rpID,
        response: asseResp,
      });

      if (verificationResp.verified) {
        await (supabase as any)
          .from("employee_devices")
          .update({ last_login: new Date().toISOString() })
          .eq("employee_id", user.id)
          .eq("device_fingerprint", localFingerprint);
      }

      return !!verificationResp.verified;
    } catch (error: any) {
      toast.error("Biometric authentication failed: " + (error.message || "Unknown error"));
      return false;
    }
  };

  const submitDeviceRegistration = async (replaceDeviceId?: string) => {
    if (!user) return;
    if (!deviceName.trim()) return toast.error("Please enter a device name");
    setBusy(true);
    try {
      const { browser, os } = getBrowserAndOS();
      const now = new Date().toISOString();

      if (replaceDeviceId) {
        const replacedDevice = trustedDevices.find((device) => device.id === replaceDeviceId);
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

      const { data: device, error } = await (supabase as any)
        .from("employee_devices")
        .upsert(
          {
            employee_id: user.id,
            device_fingerprint: localFingerprint,
            browser,
            operating_system: os,
            device_name: deviceName.trim(),
            status: "Active",
            last_login: now,
          },
          { onConflict: "employee_id,device_fingerprint" },
        )
        .select("id,device_name,device_fingerprint,browser,operating_system,status,registered_at,last_login,force_logout_at")
        .single();
      if (error) throw error;

      await logTrustedDeviceEvent({
        employeeId: user.id,
        deviceId: device.id,
        deviceFingerprint: localFingerprint,
        action: replaceDeviceId ? "replaced" : "auto_registered",
        metadata: { browser, os, deviceName: deviceName.trim(), replaceDeviceId: replaceDeviceId ?? null },
      });
      toast.success(replaceDeviceId ? "Trusted device replaced" : "Device registered as trusted");
      await checkDevice();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to register device");
    } finally {
      setBusy(false);
    }
  };

  return {
    deviceStatus,
    pendingReq,
    localFingerprint,
    deviceName,
    setDeviceName,
    trustedDevices,
    maxTrustedDevices,
    busy,
    setupBiometrics,
    verifyBiometrics,
    submitDeviceRegistration,
    checkDevice,
  };
}

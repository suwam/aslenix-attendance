import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import {
  getBrowserAndOS,
  getTrustedDeviceFingerprint,
  logTrustedDeviceEvent,
} from "@/lib/trusted-devices";

export { getBrowserAndOS };

export type DeviceStatus = "loading" | "registered" | "pending" | "rejected" | "inactive" | "unregistered";

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
      if (request.status === "Pending") {
        setDeviceStatus("pending");
        return;
      }
      if (request.status === "Approved") {
        // Since we are moving to fully automatic, if it's approved and the current device isn't registered,
        // it means HR approved but didn't actually insert it (from old logic). We will just register it now.
        // Or if HR approved and replaced, the HR tool should have inserted it.
        // Actually, the new HR logic will insert the device into employee_devices!
        // So we shouldn't even see an Approved request without a corresponding employee_devices record, 
        // unless there's a race condition. We'll handle it below by auto-registering if under limit.
      }
      if (request.status === "Rejected") {
        setDeviceStatus("rejected");
        return;
      }
    }

    // Auto-register logic
    if (devices.length < maxDevices) {
      const { browser, os } = getBrowserAndOS();
      const name = `${os} ${browser}`;
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
        .select()
        .single();

      if (!error && inserted) {
        await logTrustedDeviceEvent({
          employeeId: user.id,
          deviceId: inserted.id,
          deviceFingerprint: fingerprint,
          actorRole: "system",
          action: "auto_registered",
          metadata: { browser, os, deviceName: name },
        });
        setDeviceStatus("registered");
        setRegisteredDevices([...devices, inserted]);
        return;
      }
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

  return {
    deviceStatus,
    localFingerprint,
    registeredDevices,
    maxRegisteredDevices,
    checkDevice,
  };
}

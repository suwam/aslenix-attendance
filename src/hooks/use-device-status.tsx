import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import { 
  generateRegistrationOptions, 
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse 
} from "@/actions/webauthn";

export type DeviceStatus = "loading" | "unregistered" | "pending" | "approved" | "inactive" | "setup_biometrics";

export function getBrowserAndOS() {
  const ua = navigator.userAgent;
  let browser = "Unknown Browser";
  let os = "Unknown OS";

  if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Chrome") && !ua.includes("Edg")) browser = "Chrome";
  else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";
  else if (ua.includes("Edg")) browser = "Edge";

  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Macintosh") || ua.includes("Mac OS")) os = "macOS";
  else if (ua.includes("Linux")) os = "Linux";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";

  return { browser, os };
}

export function useDeviceStatus() {
  const { user, isAdmin } = useAuth();
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>(isAdmin ? "approved" : "loading");
  const [pendingReq, setPendingReq] = useState<any | null>(null);
  const [localFingerprint, setLocalFingerprint] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [busy, setBusy] = useState(false);

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
    
    let fingerprint = localStorage.getItem("aslenix_device_fingerprint");
    if (!fingerprint) {
      fingerprint = typeof crypto.randomUUID === "function" 
        ? crypto.randomUUID() 
        : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      localStorage.setItem("aslenix_device_fingerprint", fingerprint);
    }
    setLocalFingerprint(fingerprint);

    const { data: devices } = await supabase
      .from("employee_devices")
      .select("*")
      .eq("employee_id", user.id)
      .eq("device_fingerprint", fingerprint)
      .maybeSingle();

    if (devices) {
      if (devices.status === "Active") {
        const { data: passkey } = await (supabase as any)
          .from("device_passkeys")
          .select("id")
          .eq("employee_id", user.id)
          .eq("device_fingerprint", fingerprint)
          .maybeSingle();

        if (passkey) {
          setDeviceStatus("approved");
        } else {
          setDeviceStatus("setup_biometrics");
        }
      } else {
        setDeviceStatus("inactive");
      }
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

      const options = await generateRegistrationOptions({
        data: {
          userId: user.id,
          deviceFingerprint: localFingerprint,
          rpID,
          username,
        },
      });

      const attResp = await startRegistration({ optionsJSON: options });

      const verificationResp = await verifyRegistrationResponse({
        data: {
          userId: user.id,
          deviceFingerprint: localFingerprint,
          rpID,
          response: attResp,
        },
      });

      if (verificationResp.verified) {
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
    try {
      const rpID = window.location.hostname;
      
      const options = await generateAuthenticationOptions({
        data: {
          userId: user.id,
          deviceFingerprint: localFingerprint,
          rpID,
        },
      });

      const asseResp = await startAuthentication({ optionsJSON: options });

      const verificationResp = await verifyAuthenticationResponse({
        data: {
          userId: user.id,
          deviceFingerprint: localFingerprint,
          rpID,
          response: asseResp,
        },
      });

      return !!verificationResp.verified;
    } catch (error: any) {
      toast.error("Biometric authentication failed: " + (error.message || "Unknown error"));
      return false;
    }
  };

  const submitDeviceRegistration = async () => {
    if (!user) return;
    if (!deviceName.trim()) return toast.error("Please enter a device name");
    setBusy(true);
    const { browser, os } = getBrowserAndOS();
    const { error } = await supabase.from("pending_device_requests").insert({
      employee_id: user.id,
      device_fingerprint: localFingerprint,
      browser,
      operating_system: os,
      device_name: deviceName.trim(),
      status: "Pending"
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Device registration request submitted successfully!");
    checkDevice();
  };

  return {
    deviceStatus,
    pendingReq,
    localFingerprint,
    deviceName,
    setDeviceName,
    busy,
    setupBiometrics,
    verifyBiometrics,
    submitDeviceRegistration,
    checkDevice,
  };
}

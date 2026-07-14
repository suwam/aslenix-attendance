import FingerprintJS from "@fingerprintjs/fingerprintjs";
import { supabase } from "@/integrations/supabase/client";

const FALLBACK_DEVICE_KEY = "aslenix_device_fingerprint";

let fingerprintPromise: Promise<string> | null = null;

export type BrowserOs = {
  browser: string;
  os: string;
};

export function getBrowserAndOS(): BrowserOs {
  const ua = navigator.userAgent;
  let browser = "Unknown Browser";
  let os = "Unknown OS";

  if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Edg")) browser = "Edge";
  else if (ua.includes("Chrome") || ua.includes("CriOS")) browser = "Chrome";
  else if (ua.includes("Safari")) browser = "Safari";

  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Macintosh") || ua.includes("Mac OS")) os = "macOS";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
  else if (ua.includes("Linux")) os = "Linux";

  return { browser, os };
}

export async function getTrustedDeviceFingerprint() {
  if (!fingerprintPromise) {
    fingerprintPromise = FingerprintJS.load()
      .then((fp) => fp.get())
      .then((result) => {
        localStorage.setItem(FALLBACK_DEVICE_KEY, result.visitorId);
        return result.visitorId;
      })
      .catch(() => {
        let fallback = localStorage.getItem(FALLBACK_DEVICE_KEY);
        if (!fallback) {
          fallback =
            typeof crypto.randomUUID === "function"
              ? crypto.randomUUID()
              : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
          localStorage.setItem(FALLBACK_DEVICE_KEY, fallback);
        }
        return fallback;
      });
  }

  return fingerprintPromise;
}

export async function logTrustedDeviceEvent(input: {
  employeeId: string;
  deviceId?: string | null;
  deviceFingerprint?: string | null;
  actorId?: string | null;
  actorRole?: "employee" | "admin" | "system";
  action: string;
  metadata?: Record<string, unknown>;
}) {
  await (supabase as any).from("trusted_device_audit_logs").insert({
    employee_id: input.employeeId,
    device_id: input.deviceId ?? null,
    device_fingerprint: input.deviceFingerprint ?? null,
    actor_id: input.actorId ?? input.employeeId,
    actor_role: input.actorRole ?? "employee",
    action: input.action,
    metadata: input.metadata ?? {},
  });
}

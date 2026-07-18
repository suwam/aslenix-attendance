import type { Request } from "express";

export type DeviceMetadata = {
  deviceFingerprint: string;
  browser: string;
  operatingSystem: string;
  deviceName: string;
};

export function readDeviceMetadata(req: Request): DeviceMetadata {
  return {
    deviceFingerprint: String(
      req.body.deviceFingerprint || req.header("x-device-fingerprint") || "",
    ).trim(),
    browser: String(req.body.browser || req.header("x-device-browser") || "Unknown browser").trim(),
    operatingSystem: String(
      req.body.operatingSystem || req.header("x-device-os") || "Unknown OS",
    ).trim(),
    deviceName: String(
      req.body.deviceName || req.header("x-device-name") || "Unknown device",
    ).trim(),
  };
}

export function getRequestIp(req: Request) {
  const forwardedFor = req.header("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || req.socket.remoteAddress || req.ip || "unknown";
}

import FingerprintJS from "@fingerprintjs/fingerprintjs";

let fingerprintPromise: Promise<string> | null = null;

function parseBrowser(userAgent: string) {
  if (/Edg\//.test(userAgent)) return "Microsoft Edge";
  if (/Chrome\//.test(userAgent)) return "Chrome";
  if (/Firefox\//.test(userAgent)) return "Firefox";
  if (/Safari\//.test(userAgent)) return "Safari";
  return "Unknown browser";
}

function parseOperatingSystem(userAgent: string) {
  if (/Windows/i.test(userAgent)) return "Windows";
  if (/Mac OS X/i.test(userAgent)) return "macOS";
  if (/Android/i.test(userAgent)) return "Android";
  if (/iPhone|iPad/i.test(userAgent)) return "iOS";
  if (/Linux/i.test(userAgent)) return "Linux";
  return "Unknown OS";
}

export async function getDeviceMetadata() {
  fingerprintPromise ??= FingerprintJS.load().then(async (agent) => {
    const result = await agent.get();
    return result.visitorId;
  });

  const userAgent = navigator.userAgent;
  const browser = parseBrowser(userAgent);
  const operatingSystem = parseOperatingSystem(userAgent);
  const platform = navigator.platform || operatingSystem;

  return {
    deviceFingerprint: await fingerprintPromise,
    browser,
    operatingSystem,
    deviceName: `${browser} on ${platform}`,
  };
}

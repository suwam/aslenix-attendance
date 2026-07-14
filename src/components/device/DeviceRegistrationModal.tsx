import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import { useDeviceStatus, getBrowserAndOS } from "@/hooks/use-device-status";
import { Fingerprint, ShieldCheck, TimerReset, Loader2, ShieldX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";

export function DeviceRegistrationModal() {
  const {
    deviceStatus,
    pendingReq,
    localFingerprint,
    deviceName,
    setDeviceName,
    trustedDevices,
    maxTrustedDevices,
    busy,
    setupBiometrics,
    submitDeviceRegistration,
  } = useDeviceStatus();

  const [isOpen, setIsOpen] = useState(false);
  const [replaceDeviceId, setReplaceDeviceId] = useState("");

  useEffect(() => {
    // Only pop up if we haven't prompted yet in this session
    const hasPrompted = sessionStorage.getItem("device_prompted");
    if (!hasPrompted && (deviceStatus === "unregistered" || deviceStatus === "setup_biometrics" || deviceStatus === "replace_required")) {
      setIsOpen(true);
    }
  }, [deviceStatus]);

  const handleClose = () => {
    sessionStorage.setItem("device_prompted", "true");
    setIsOpen(false);
  };

  // If loading or approved, we do not show the modal.
  if (deviceStatus === "loading" || deviceStatus === "approved" || !isOpen) {
    return null;
  }

  const { browser, os } = getBrowserAndOS();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="sm:max-w-md [&>button]:hidden" onInteractOutside={(e) => e.preventDefault()}>
        
        {/* Custom Close Button */}
        <button 
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
        
        {deviceStatus === "setup_biometrics" && (
          <div className="p-6 sm:p-2 space-y-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-foreground shadow-[0_0_34px_rgba(99,102,241,.38)]">
              <Fingerprint size={28} />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-foreground">Setup Biometrics</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Your device has been approved! To securely use the app and check in, you need to register a Passkey using your device's native biometric authentication (Face ID, Touch ID, or Windows Hello).
              </p>
            </div>

            <Button
              onClick={setupBiometrics}
              disabled={busy}
              className="w-full neon-button h-12 rounded-xl text-base font-semibold bg-indigo-600 hover:bg-indigo-700"
            >
              {busy ? <Loader2 size={18} className="mr-2 animate-spin" /> : <ShieldCheck size={18} className="mr-2" />}
              Setup Biometrics
            </Button>
          </div>
        )}

        {deviceStatus === "unregistered" && (
          <div className="p-6 sm:p-2 space-y-6">
            <div className="text-center space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 via-violet-500 to-pink-500 text-foreground shadow-[0_0_34px_rgba(125,92,255,.38)]">
                <Fingerprint size={28} />
              </div>
              <h2 className="text-2xl font-bold text-foreground font-display">Register This Device</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                To ensure secure access, you must register this device with the HRMS before continuing.
              </p>
            </div>

            <div className="space-y-3.5 rounded-2xl bg-card/65 p-4 text-sm border border-border/40">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Operating System:</span>
                <span className="font-semibold text-foreground">{os}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Browser:</span>
                <span className="font-semibold text-foreground">{browser}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Device Fingerprint:</span>
                <span className="font-semibold text-foreground font-mono text-xs max-w-[200px] truncate" title={localFingerprint}>
                  {localFingerprint}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-foreground">Device Name</label>
              <input
                type="text"
                placeholder="e.g. My Personal Laptop, Office PC"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-border bg-card text-foreground focus:outline-none focus:border-primary text-sm"
              />
            </div>

            <Button
              onClick={() => submitDeviceRegistration()}
              disabled={busy}
              className="w-full neon-button h-12 rounded-xl text-base font-semibold"
            >
              {busy ? <Loader2 size={18} className="mr-2 animate-spin" /> : <ShieldCheck size={18} className="mr-2" />}
              Submit Registration Request
            </Button>
          </div>
        )}

        {deviceStatus === "replace_required" && (
          <div className="p-6 sm:p-2 space-y-6">
            <div className="text-center space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-warning/30 bg-warning/10 text-warning shadow-[0_0_34px_rgba(245,158,11,.15)]">
                <ShieldCheck size={28} />
              </div>
              <h2 className="text-2xl font-bold text-foreground font-display">Device Limit Reached</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Your account allows {maxTrustedDevices} trusted devices. Choose one existing device to replace, then HR can approve this new device.
              </p>
            </div>

            <div className="space-y-2">
              {trustedDevices.map((device) => (
                <button
                  key={device.id}
                  type="button"
                  onClick={() => setReplaceDeviceId(device.id)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    replaceDeviceId === device.id ? "border-primary bg-primary/10" : "border-border bg-card/65 hover:border-primary/40"
                  }`}
                >
                  <div className="font-semibold text-foreground">{device.device_name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {device.operating_system} · {device.browser} · Last login {new Date(device.last_login).toLocaleDateString()}
                  </div>
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-foreground">New Device Name</label>
              <input
                type="text"
                placeholder="e.g. New iPhone, Home Laptop"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-border bg-card text-foreground focus:outline-none focus:border-primary text-sm"
              />
            </div>

            <Button
              onClick={() => submitDeviceRegistration(replaceDeviceId)}
              disabled={busy || !replaceDeviceId}
              className="w-full neon-button h-12 rounded-xl text-base font-semibold"
            >
              {busy ? <Loader2 size={18} className="mr-2 animate-spin" /> : <ShieldCheck size={18} className="mr-2" />}
              Request Replacement
            </Button>
          </div>
        )}

        {deviceStatus === "pending" && (
          <div className="p-6 sm:p-2 space-y-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-warning/30 bg-warning/10 text-warning shadow-[0_0_34px_rgba(245,158,11,.15)] animate-pulse">
              <TimerReset size={28} />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-foreground">Registration Pending Approval</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Your device registration request has been submitted successfully and is waiting for HR/Admin approval.
              </p>
            </div>

            <div className="space-y-3.5 rounded-2xl bg-card/65 p-4 text-sm border border-border/40 text-left">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Device Name:</span>
                <span className="font-semibold text-foreground">{pendingReq?.device_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">OS / Browser:</span>
                <span className="font-semibold text-foreground">{pendingReq?.operating_system} · {pendingReq?.browser}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Submitted:</span>
                <span className="font-semibold text-foreground">
                  {pendingReq?.requested_at ? new Date(pendingReq.requested_at).toLocaleDateString() : ""}
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              You will not be able to check-in until this device is approved.
            </p>
          </div>
        )}

        {deviceStatus === "inactive" && (
          <div className="p-6 sm:p-2 space-y-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-destructive/30 bg-destructive/10 text-destructive shadow-[0_0_34px_rgba(239,68,68,.15)]">
              <ShieldX size={28} />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-foreground">Device Deactivated</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                This device has been deactivated by an administrator. You cannot use this device for attendance anymore.
              </p>
            </div>
          </div>
        )}

      </DialogContent>
    </Dialog>
  );
}

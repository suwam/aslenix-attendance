import { useEffect, useRef } from "react";

type UseAppResumeOptions = {
  /** Minimum interval between invocations in milliseconds (default 1500ms) */
  throttleMs?: number;
  /** Optional background polling interval in milliseconds while the page is visible */
  pollIntervalMs?: number;
  /** Whether the listener is currently active (default true) */
  enabled?: boolean;
};

/**
 * Hook to automatically trigger a callback when the user resumes the app
 * (e.g. unlocks mobile device, returns from another app, switches tabs, or reconnects).
 */
export function useAppResume(
  callback: (reason: string) => void | Promise<void>,
  options: UseAppResumeOptions = {},
) {
  const { throttleMs = 1500, pollIntervalMs, enabled = true } = options;
  const lastTriggerRef = useRef<number>(0);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const fire = (reason: string) => {
      const now = Date.now();
      if (now - lastTriggerRef.current < throttleMs) return;
      lastTriggerRef.current = now;
      try {
        callbackRef.current(reason);
      } catch (err) {
        console.error(`[useAppResume] Error during resume (${reason}):`, err);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fire("visibilitychange");
      }
    };

    const handlePageShow = (e: PageTransitionEvent) => {
      fire(e.persisted ? "pageshow-persisted" : "pageshow");
    };

    const handleFocus = () => {
      fire("focus");
    };

    const handleOnline = () => {
      fire("online");
    };

    const handleCustomResumed = () => {
      fire("app:resumed");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("online", handleOnline);
    window.addEventListener("app:resumed", handleCustomResumed);

    let intervalId: number | null = null;
    if (pollIntervalMs && pollIntervalMs > 0) {
      intervalId = window.setInterval(() => {
        if (document.visibilityState === "visible") {
          fire("poll");
        }
      }, pollIntervalMs);
    }

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("app:resumed", handleCustomResumed);
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
    };
  }, [enabled, throttleMs, pollIntervalMs]);
}


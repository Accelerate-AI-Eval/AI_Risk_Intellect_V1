import { useEffect, useRef } from "react";
import {
  IDLE_LOGOUT_TIMEOUT_MS,
  scheduleIdleSignOut,
} from "./authFetch";

const IDLE_CHECK_MS = 30_000;

const ACTIVITY_EVENTS = [
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
  "click",
  "wheel",
] as const;

/** Signs the user out after 15 minutes without user activity. */
export function useIdleLogout(enabled: boolean): void {
  const lastActivityRef = useRef(Date.now());

  useEffect(() => {
    if (!enabled) return;

    lastActivityRef.current = Date.now();

    const recordActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const checkIdle = () => {
      if (!sessionStorage.getItem("accessToken")) return;
      if (Date.now() - lastActivityRef.current < IDLE_LOGOUT_TIMEOUT_MS) return;
      scheduleIdleSignOut();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") checkIdle();
    };

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, recordActivity, { passive: true });
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    const intervalId = window.setInterval(checkIdle, IDLE_CHECK_MS);

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, recordActivity);
      }
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.clearInterval(intervalId);
    };
  }, [enabled]);
}

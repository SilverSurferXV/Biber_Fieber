import React, { useEffect, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { nanoid } from "nanoid";
import { postTrackingEvent } from "../endpoints/tracking/event_POST.schema";
import { useCallbackRef } from "./useCallbackRef";

const SESSION_KEY = "biber_session_id";

function getSessionId() {
  if (typeof window === "undefined") return "";
  let sid = sessionStorage.getItem(SESSION_KEY);
  if (!sid) {
    sid = nanoid();
    sessionStorage.setItem(SESSION_KEY, sid);
  }
  return sid;
}

/**
 * Hook to track page visits and tab clicks.
 * On mount, generates/restores a session ID. Tracks location changes to calculate
 * page dwell time and sends events via the tracking endpoint.
 */
export function useTracking() {
  const location = useLocation();
  const sessionId = getSessionId();

  const currentPathRef = useRef(location.pathname);
  const entryTimeRef = useRef(Date.now());

  // Use the standard fetch API for normal transitions
  const sendPageVisit = useCallbackRef((path: string, durationSeconds: number) => {
    postTrackingEvent({
      sessionId,
      eventType: "page_visit",
      pagePath: path,
      durationSeconds,
    }).catch(console.error);
  });

  // Use navigator.sendBeacon for unload scenarios to ensure the request goes through
  const sendBeaconPageVisit = useCallbackRef((path: string, durationSeconds: number) => {
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const payload = {
        sessionId,
        eventType: "page_visit",
        pagePath: path,
        durationSeconds,
      };
      // Note: Endpoint expects superjson or standard JSON. We send JSON.
      navigator.sendBeacon("/_api/tracking/event", JSON.stringify(payload));
    }
  });

  useEffect(() => {
    if (currentPathRef.current !== location.pathname) {
      const now = Date.now();
      const duration = (now - entryTimeRef.current) / 1000;
      sendPageVisit(currentPathRef.current, duration);

      currentPathRef.current = location.pathname;
      entryTimeRef.current = now;
    }
  }, [location.pathname, sendPageVisit]);

  useEffect(() => {
    const handleUnload = () => {
      const now = Date.now();
      const duration = (now - entryTimeRef.current) / 1000;
      sendBeaconPageVisit(currentPathRef.current, duration);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        handleUnload();
      } else if (document.visibilityState === "visible") {
        // Reset entry time when user returns to the tab
        entryTimeRef.current = Date.now();
      }
    };

    window.addEventListener("beforeunload", handleUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [sendBeaconPageVisit]);

  const trackTabClick = useCallback(
    (tabName: string) => {
      postTrackingEvent({
        sessionId,
        eventType: "tab_click",
        pagePath: currentPathRef.current,
        tabName,
      }).catch(console.error);
    },
    [sessionId]
  );

  return { trackTabClick };
}

/**
 * A provider to easily wrap the application for global tracking.
 */
export function TrackingProvider({ children }: { children: React.ReactNode }) {
  useTracking();
  return <>{children}</>;
}
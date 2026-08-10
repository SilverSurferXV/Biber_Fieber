import React, { createContext, useContext, useEffect, useState, useMemo } from "react";

export type ConnectionQuality = "fast" | "medium" | "slow";

export interface ConnectionState {
  quality: ConnectionQuality;
  preferThumbnails: boolean;
  reduceAnimations: boolean;
  reducedDataMode: boolean;
  effectiveType: string | null;
}

const ConnectionQualityContext = createContext<ConnectionState | undefined>(undefined);

// Extend navigator interface for Network Information API
declare global {
  interface Navigator {
    connection?: any;
    mozConnection?: any;
    webkitConnection?: any;
  }
}

export const ConnectionQualityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<{
    quality: ConnectionQuality;
    effectiveType: string | null;
    saveData: boolean;
  }>({
    quality: "fast",
    effectiveType: null,
    saveData: false,
  });

  useEffect(() => {
    let intervalId: number;

    const measureFallback = (): ConnectionQuality => {
      if (typeof performance === "undefined" || !performance.getEntriesByType) return "fast";
      
      const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
      if (resources.length === 0) return "fast";

      let totalSize = 0;
      let totalDuration = 0;

      // Look at the most recent resources
      const recentResources = resources.slice(-20);

      for (const res of recentResources) {
        if (res.transferSize > 0 && res.duration > 0) {
          totalSize += res.transferSize; // in bytes
          totalDuration += res.duration; // in milliseconds
        }
      }

      if (totalDuration === 0) return "fast";

      // Calculate speed in KB/s: (bytes / 1024) / (ms / 1000)
      const speedKbps = (totalSize / 1024) / (totalDuration / 1000);

      if (speedKbps < 50) return "slow";
      if (speedKbps < 200) return "medium";
      return "fast";
    };

    const updateConnectionStatus = () => {
      if (!navigator.onLine) {
        setState({ quality: "slow", effectiveType: null, saveData: false });
        return;
      }

      const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

      if (conn) {
        const effectiveType = conn.effectiveType;
        const saveData = conn.saveData === true;
        let quality: ConnectionQuality = "fast";

        if (saveData) {
          quality = "slow";
        } else if (effectiveType === "slow-2g" || effectiveType === "2g") {
          quality = "slow";
        } else if (effectiveType === "3g") {
          quality = "medium";
        } else {
          quality = "fast";
        }

        setState({ quality, effectiveType: effectiveType || null, saveData });
      } else {
        // Fallback for browsers like Safari and Firefox
        const fallbackQuality = measureFallback();
        setState({ quality: fallbackQuality, effectiveType: null, saveData: false });
      }
    };

    // Initial check
    updateConnectionStatus();

    // Listeners for online/offline events
    window.addEventListener("online", updateConnectionStatus);
    window.addEventListener("offline", updateConnectionStatus);

    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    
    if (conn && typeof conn.addEventListener === "function") {
      conn.addEventListener("change", updateConnectionStatus);
    } else {
      // Fallback polling for Safari/Firefox
      intervalId = window.setInterval(updateConnectionStatus, 30000);
    }

    return () => {
      window.removeEventListener("online", updateConnectionStatus);
      window.removeEventListener("offline", updateConnectionStatus);
      if (conn && typeof conn.removeEventListener === "function") {
        conn.removeEventListener("change", updateConnectionStatus);
      }
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []);

  const value = useMemo<ConnectionState>(() => {
    return {
      quality: state.quality,
      effectiveType: state.effectiveType,
      preferThumbnails: state.quality === "medium" || state.quality === "slow",
      reduceAnimations: state.quality === "slow",
      reducedDataMode: state.quality === "slow" || state.saveData,
    };
  }, [state]);

  return (
    <ConnectionQualityContext.Provider value={value}>
      {children}
    </ConnectionQualityContext.Provider>
  );
};

export const useConnectionQuality = (): ConnectionState => {
  const context = useContext(ConnectionQualityContext);
  if (context === undefined) {
    throw new Error("useConnectionQuality must be used within a ConnectionQualityProvider");
  }
  return context;
};
/**
 * Detects if the application is currently running inside a Capacitor native mobile app shell
 * (iOS or Android) rather than a regular web browser.
 */
export function isNativeApp(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    // Capacitor injects itself into the global window object in its native webview
    const Capacitor = (window as any).Capacitor;

    if (!Capacitor) {
      return false;
    }

    // Modern Capacitor check
    if (typeof Capacitor.isNativePlatform === "function") {
      return Capacitor.isNativePlatform();
    }

    // Fallbacks for older versions or alternative Capacitor setups
    if (Capacitor.isNative === true) {
      return true;
    }

    if (Capacitor.platform === "ios" || Capacitor.platform === "android") {
      return true;
    }

    return false;
  } catch (error) {
    console.error("Failed to detect Capacitor native platform:", error);
    return false;
  }
}
import { isNativeApp } from "./isNativeApp";

export function getClientPlatform(): "ios-app" | "android-app" | "web" {
  if (isNativeApp()) {
    try {
      // Capacitor exposes itself globally
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Capacitor = (window as any).Capacitor;
      const platform = Capacitor?.getPlatform?.() || Capacitor?.platform;
      
      if (platform === "ios") return "ios-app";
      if (platform === "android") return "android-app";
    } catch (e) {
      // Ignore errors and fallback to web
    }
  }
  return "web";
}
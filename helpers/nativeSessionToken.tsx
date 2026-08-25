import { isNativeApp } from "./isNativeApp";

const STORAGE_KEY = "floot_native_session_token";

/**
 * nativeSessionToken
 * 
 * In iOS WKWebView (and some Android setups), cross-site session cookies are blocked,
 * meaning requests from the native wrapper (e.g. `capacitor://localhost`) reach the backend
 * with no cookie header at all.
 * 
 * This helper stores the exact same signed session JWT that the cookie would carry,
 * but in localStorage, allowing native clients to attach it manually (e.g. via Authorization header).
 * To ensure the web app remains untouched and continues using standard HttpOnly cookies,
 * the token is ONLY saved if `isNativeApp()` is true.
 */
export const nativeSessionToken = {
  /**
   * Retrieves the native session token from localStorage.
   */
  get(): string | null {
    if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
      return null;
    }
    
    try {
      return window.localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      console.error("[nativeSessionToken] Failed to read token from localStorage:", error);
      return null;
    }
  },

  /**
   * Stores the session token in localStorage.
   * If the token is empty, null, or undefined, the key is removed.
   * Only operates if running inside a native mobile app.
   */
  set(token: string | null | undefined): void {
    if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
      return;
    }
    
    // Web app behavior stays unchanged; only natively-wrapped apps need this workaround
    if (!isNativeApp()) {
      return;
    }

    try {
      if (!token) {
        window.localStorage.removeItem(STORAGE_KEY);
      } else {
        window.localStorage.setItem(STORAGE_KEY, token);
      }
    } catch (error) {
      console.error("[nativeSessionToken] Failed to set token in localStorage:", error);
    }
  },

  /**
   * Clears the native session token from localStorage.
   */
  clear(): void {
    if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
      return;
    }
    
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error("[nativeSessionToken] Failed to clear token from localStorage:", error);
    }
  }
};
// TEMPORARY DIAGNOSTIC HELPER
// This file is used to prove whether requests from the native mobile app reach the backend 
// and whether they carry the session cookie. It can be safely removed once the native data-loading issue is resolved.

export function logNativeRequestProbe(
  request: Request,
  label: string,
  extra?: Record<string, unknown>
): void {
  try {
    const origin = request.headers.get("origin");
    const userAgent = request.headers.get("user-agent") || "";
    
    let isNative = false;

    // Check origin
    if (origin) {
      if (
        origin === "capacitor://localhost" ||
        origin === "https://localhost" ||
        origin.startsWith("capacitor://") ||
        origin.startsWith("ionic://")
      ) {
        isNative = true;
      }
    } else {
      // Check UA heuristic for Capacitor iOS webview when no origin is present
      if (
        userAgent.includes("AppleWebKit/605.1.15") &&
        !userAgent.includes("Safari/") &&
        !userAgent.includes("Chrome/")
      ) {
        isNative = true;
      }
    }

    if (!isNative) {
      return;
    }

    const cookieHeader = request.headers.get("cookie");
    const cookieNames: string[] = [];
    let hasSessionCookie = false;

    if (cookieHeader) {
      const cookies = cookieHeader.split(";");
      for (const cookie of cookies) {
        const name = cookie.split("=")[0]?.trim();
        if (name) {
          cookieNames.push(name);
          if (name === "floot_built_app_session") {
            hasSessionCookie = true;
          }
        }
      }
    }

    let pathname = "";
    try {
      pathname = new URL(request.url).pathname;
    } catch {
      pathname = request.url;
    }

    const logData = {
      label,
      method: request.method,
      pathname,
      origin: origin || "(none)",
      userAgent,
      hasCookieHeader: !!cookieHeader,
      cookieNames,
      hasSessionCookie,
      hasAuthHeader: request.headers.has("authorization"),
      ...(extra || {}),
    };

    console.log(`[native-probe]`, logData);
  } catch (err) {
    console.error("[native-probe] failed to log probe data", err);
  }
}
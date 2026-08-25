import { isNativeApp } from "./isNativeApp";
import { getClientPlatform } from "./getClientPlatform";
import { nativeSessionToken } from "./nativeSessionToken";

export const PUBLISHED_ORIGIN = "https://biberfieber.floot.app";

function needsAbsoluteBase(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const protocol = window.location.protocol;
  // If we are served via a native app protocol or local file
  if (protocol === "capacitor:" || protocol === "ionic:" || protocol === "file:") {
    return true;
  }
  // If we are running inside the native wrapper but served from a local dev server fallback
  if (isNativeApp() && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) {
    return true;
  }
  return false;
}

let forceAbsoluteBase = false;
let authorizationHeaderDisabled = false;

export function installApiFetchGuard() {
  if (typeof window === "undefined") {
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const win = window as any;
  
  // Make installation strictly idempotent and non-nesting
  if (win.__apiFetchGuardInstalled || (win.fetch && win.fetch.__isApiFetchGuard)) {
    return;
  }
  
  if (!win.__apiFetchGuardOriginalFetch) {
    win.__apiFetchGuardOriginalFetch = window.fetch.bind(window);
  }
  
  win.__apiFetchGuardInstalled = true;

  const originalFetch = win.__apiFetchGuardOriginalFetch;

  const patchedFetch = async function (input: RequestInfo | URL, init?: RequestInit) {
    let urlStr = "";
    let reqObj: Request | null = null;

    // Normalize input to extract the URL and a possible Request object
    if (typeof input === "string") {
      urlStr = input;
    } else if (input instanceof URL) {
      urlStr = input.toString();
    } else {
      reqObj = input;
      urlStr = reqObj.url;
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(urlStr, window.location.href);
    } catch (e) {
      // If parsing fails, pass through transparently
      return originalFetch(input, init);
    }

    // Only intercept Floot API requests
    if (!parsedUrl.pathname.startsWith("/_api/")) {
      return originalFetch(input, init);
    }

    const shouldRewrite = forceAbsoluteBase || needsAbsoluteBase();
    let targetUrlStr = urlStr;
    let targetInput: RequestInfo | URL = input;
    let targetInit = init ? { ...init } : undefined;

    // Fix relative base URL for native apps if needed
    if (
      shouldRewrite &&
      (parsedUrl.origin === window.location.origin ||
        parsedUrl.hostname === "localhost" ||
        (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:"))
    ) {
      targetUrlStr = `${PUBLISHED_ORIGIN}${parsedUrl.pathname}${parsedUrl.search}`;
      if (reqObj) {
        // Clone original request to not consume its body permanently in case we need to retry
        targetInput = new Request(targetUrlStr, reqObj.clone());
      } else {
        targetInput = targetUrlStr;
      }
      // Native iOS/Android requires cookies to be forcefully included for absolute cross-origin
      targetInit = { ...(targetInit || {}), credentials: "include" };
    } else if (reqObj) {
      // Clone so we don't consume the caller's Request object in the first attempt
      targetInput = reqObj.clone();
    }

    // Attach Authorization header for native app session fallback
    const token = nativeSessionToken.get();
    let addedAuthorization = false;
    
    if (token && !authorizationHeaderDisabled) {
      let currentHeaders = new Headers(targetInit?.headers);
      
      // Also pull from Request if we built one
      if (reqObj && targetInput instanceof Request) {
        currentHeaders = new Headers(targetInput.headers);
        if (targetInit?.headers) {
            const initHeaders = new Headers(targetInit.headers);
            initHeaders.forEach((value, key) => currentHeaders.set(key, value));
        }
      }

      if (!currentHeaders.has("authorization")) {
        currentHeaders.set("Authorization", `Bearer ${token}`);
        addedAuthorization = true;

        if (targetInput instanceof Request) {
          const originalReq = targetInput;
          targetInput = new Request(targetInput.url, {
            method: originalReq.method,
            headers: currentHeaders,
            body: originalReq.body,
            mode: originalReq.mode,
            credentials: originalReq.credentials,
            cache: originalReq.cache,
            redirect: originalReq.redirect,
            referrer: originalReq.referrer,
            integrity: originalReq.integrity,
          });
        } else {
          targetInit = { ...(targetInit || {}), headers: currentHeaders };
        }
      }
    }

    try {
      let response = await originalFetch(targetInput, targetInit);
      const ct = response.headers.get("content-type") || "";

      const isHtml = ct.includes("text/html");
      const isEmptyAndError = !response.ok && ct.trim() === "";

      // We suspect an issue if the endpoint returned HTML (e.g., a host routing error) or empty content-type on error
      if (isHtml || isEmptyAndError) {
        if (response.bodyUsed) {
          return response;
        }

        let text = "";
        try {
          // Read the body fully instead of cloning, to avoid double-consumption issues
          text = await response.text();
          // Construct a fresh Response so the caller still gets a readable body
          response = new Response(text, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
          });
        } catch (e) {
          console.warn("[apiFetchGuard] Failed to read response body for inspection:", e);
          return response; // Return the original response untouched
        }

        const snippet = text.trim().substring(0, 200);
        const isBrokenHtml = text.trim().startsWith("<");

        if (isBrokenHtml) {
          const diagnostic = {
            url: targetUrlStr,
            status: response.status,
            contentType: ct,
            bodySnippet: snippet,
            href: window.location.href,
            origin: window.location.origin,
            platform: getClientPlatform(),
            userAgent: navigator.userAgent,
            message: "HTML returned instead of JSON",
          };

          console.error("[apiFetchGuard] API returned broken response:", diagnostic);
          navigator.sendBeacon(
            `${PUBLISHED_ORIGIN}/_api/diagnostics/client-error`,
            new Blob([JSON.stringify(diagnostic)], { type: "text/plain" })
          );

          // Retry logic (only if we didn't already try the published origin)
          if (!targetUrlStr.startsWith(PUBLISHED_ORIGIN)) {
            const retryUrlStr = `${PUBLISHED_ORIGIN}${parsedUrl.pathname}${parsedUrl.search}`;
            const retryInput = reqObj
              ? new Request(retryUrlStr, reqObj.clone())
              : retryUrlStr;
            const retryInit: RequestInit = { ...(init || {}), credentials: "include" as RequestCredentials };

            try {
              let retryResponse = await originalFetch(retryInput, retryInit);
              const retryCt = retryResponse.headers.get("content-type") || "";
              const retryIsHtml = retryCt.includes("text/html");
              const retryIsEmptyAndError = !retryResponse.ok && retryCt.trim() === "";
              let isRetryBroken = false;

              if (retryIsHtml || retryIsEmptyAndError) {
                if (!retryResponse.bodyUsed) {
                  let retryText = "";
                  let retryInspectionFailed = false;
                  try {
                    retryText = await retryResponse.text();
                    retryResponse = new Response(retryText, {
                      status: retryResponse.status,
                      statusText: retryResponse.statusText,
                      headers: retryResponse.headers,
                    });
                  } catch (e) {
                    console.warn("[apiFetchGuard] Failed to read retry response body for inspection:", e);
                    retryInspectionFailed = true;
                  }

                  if (!retryInspectionFailed) {
                    const retryIsBrokenHtml = retryText.trim().startsWith("<");
                    if (retryIsBrokenHtml) {
                      isRetryBroken = true;
                    }
                  }
                }
              }

              if (!isRetryBroken) {
                forceAbsoluteBase = true;
                return retryResponse;
              }
            } catch (retryErr) {
              // Fall through to throw standard error
            }
          }

          throw new Error(
            "Verbindung zum Server fehlgeschlagen. Bitte prüfe deine Internetverbindung und versuche es erneut."
          );
        }
      }

      // Safe JSON or binary response
      return response;
    } catch (err) {
      // If a network/CORS error occurred while we added an Authorization header,
      // retry once without it and disable adding it for the rest of the session.
      if (addedAuthorization && !authorizationHeaderDisabled) {
        console.warn("[apiFetchGuard] Network/CORS error with Authorization header. Retrying without it.");
        
        authorizationHeaderDisabled = true;

        const diagnostic = {
          url: targetUrlStr,
          href: window.location.href,
          origin: window.location.origin,
          platform: getClientPlatform(),
          userAgent: navigator.userAgent,
          message: "Authorization header rejected or caused CORS error, disabled for session.",
        };
        navigator.sendBeacon(
          `${PUBLISHED_ORIGIN}/_api/diagnostics/client-error`,
          new Blob([JSON.stringify(diagnostic)], { type: "text/plain" })
        );

        // Construct inputs for retry without the Authorization header
        let retryInput: RequestInfo | URL = input;
        let retryInit = init ? { ...init } : undefined;

        if (shouldRewrite && (parsedUrl.origin === window.location.origin || parsedUrl.hostname === "localhost" || (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:"))) {
          const retryUrlStr = `${PUBLISHED_ORIGIN}${parsedUrl.pathname}${parsedUrl.search}`;
          if (reqObj) {
            retryInput = new Request(retryUrlStr, reqObj.clone());
          } else {
            retryInput = retryUrlStr;
          }
          retryInit = { ...(retryInit || {}), credentials: "include" };
        } else if (reqObj) {
          retryInput = reqObj.clone();
        }

        return originalFetch(retryInput, retryInit);
      }

      if (
        err instanceof Error &&
        err.message.includes("Verbindung zum Server fehlgeschlagen")
      ) {
        throw err;
      }

      const diagnostic = {
        url: targetUrlStr,
        href: window.location.href,
        origin: window.location.origin,
        platform: getClientPlatform(),
        userAgent: navigator.userAgent,
        message: err instanceof Error ? err.message : String(err),
      };

      console.error("[apiFetchGuard] Network error during fetch:", diagnostic);
      navigator.sendBeacon(
        `${PUBLISHED_ORIGIN}/_api/diagnostics/client-error`,
        new Blob([JSON.stringify(diagnostic)], { type: "text/plain" })
      );

      throw new Error(
        "Keine Verbindung zum Server. Bitte prüfe deine Internetverbindung und versuche es erneut."
      );
    }
  };

  // Add the marker so we don't accidentally nest the guard
  (patchedFetch as any).__isApiFetchGuard = true;
  window.fetch = patchedFetch as typeof window.fetch;
}
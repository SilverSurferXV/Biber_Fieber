import { isNativeApp } from "./isNativeApp";
import { getClientPlatform } from "./getClientPlatform";

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

export function installApiFetchGuard() {
  if (typeof window === "undefined") {
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const win = window as any;
  
  if (!win.__apiFetchGuardOriginalFetch) {
    win.__apiFetchGuardOriginalFetch = window.fetch.bind(window);
  }
  
  win.__apiFetchGuardInstalled = true;

  const originalFetch = win.__apiFetchGuardOriginalFetch;

  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
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

    try {
      const response = await originalFetch(targetInput, targetInit);
      const ct = response.headers.get("content-type") || "";

      const isHtmlOrEmpty = ct.includes("text/html") || ct.trim() === "";
      const isErrorNotJson = !response.ok && !ct.includes("json");

      // We suspect an issue if the endpoint returned HTML (e.g., a host routing error), empty content-type, or a non-JSON error
      if (isHtmlOrEmpty || isErrorNotJson) {
        if (response.bodyUsed) {
          return response;
        }

        let text = "";
        try {
          const clone = response.clone();
          text = (await clone.text()).trim().substring(0, 200);
        } catch (e) {
          console.warn("[apiFetchGuard] Failed to read response body for inspection:", e);
          return response;
        }

        const isBrokenHtml = text.startsWith("<");
        const isBrokenError = !response.ok && !text.startsWith("{") && !text.startsWith("[");

        if (isBrokenHtml || isBrokenError) {
          const diagnostic = {
            url: targetUrlStr,
            status: response.status,
            contentType: ct,
            bodySnippet: text,
            href: window.location.href,
            origin: window.location.origin,
            platform: getClientPlatform(),
            userAgent: navigator.userAgent,
            message: isBrokenHtml ? "HTML returned instead of JSON" : "Non-JSON error response",
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
              const retryResponse = await originalFetch(retryInput, retryInit);
              const retryCt = retryResponse.headers.get("content-type") || "";
              const retryIsHtmlOrEmpty = retryCt.includes("text/html") || retryCt.trim() === "";
              const retryIsErrorNotJson = !retryResponse.ok && !retryCt.includes("json");
              let isRetryBroken = false;

              if (retryIsHtmlOrEmpty || retryIsErrorNotJson) {
                if (!retryResponse.bodyUsed) {
                  let retryText = "";
                  let retryInspectionFailed = false;
                  try {
                    const retryClone = retryResponse.clone();
                    retryText = (await retryClone.text()).trim().substring(0, 200);
                  } catch (e) {
                    console.warn("[apiFetchGuard] Failed to read retry response body for inspection:", e);
                    retryInspectionFailed = true;
                  }

                  if (!retryInspectionFailed) {
                    const retryIsBrokenHtml = retryText.startsWith("<");
                    const retryIsBrokenError = !retryResponse.ok && !retryText.startsWith("{") && !retryText.startsWith("[");
                    if (retryIsBrokenHtml || retryIsBrokenError) {
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
}
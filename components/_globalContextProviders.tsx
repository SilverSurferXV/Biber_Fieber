import { ReactNode, useEffect, useRef } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import OneSignal from "react-onesignal";
import { ONESIGNAL_APP_ID } from "../helpers/_publicConfigs";
import { TooltipProvider } from "./Tooltip";
import { ThemeModeProvider } from "../helpers/themeMode";
import { SonnerToaster } from "./SonnerToaster";
import { ScrollToHashElement } from "./ScrollToHashElement";
import { AuthProvider, useAuth } from "../helpers/useAuth";
import { CartProvider } from "../helpers/useCart";
import { TrackingProvider } from "../helpers/useTracking";
import { Helmet } from "react-helmet";
import { CookieConsentProvider, useCookieConsent } from "../helpers/useCookieConsent";
import { CookieConsent } from "./CookieConsent";
import { resolveFileUrl } from "../helpers/resolveFileUrl";
import { ConnectionQualityProvider } from "../helpers/useConnectionQuality";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnMount: false,
      refetchOnWindowFocus: false,
    },
  },
});

const OneSignalIdentifier = () => {
  const { authState } = useAuth();

  useEffect(() => {
    const updateOneSignal = async () => {
      try {
        if (authState.type === "authenticated") {
          await OneSignal.login(String(authState.user.id));
        } else if (authState.type === "unauthenticated") {
          await OneSignal.logout();
        }
      } catch (error) {
        console.error("Failed to update OneSignal external user ID:", error);
      }
    };

    updateOneSignal();
  }, [authState]);

  return null;
};

const ConsentAwareProviders = ({ children }: { children: ReactNode }) => {
  const { consent } = useCookieConsent();
  const isOneSignalInitialized = useRef(false);

  useEffect(() => {
    if (ONESIGNAL_APP_ID && consent.marketing && !isOneSignalInitialized.current) {
      isOneSignalInitialized.current = true;
      OneSignal.init({ appId: ONESIGNAL_APP_ID }).catch(console.error);
    }
  }, [consent.marketing]);

  return (
    <>
      {consent.marketing && <OneSignalIdentifier />}
      {consent.analytics ? (
        <TrackingProvider>{children}</TrackingProvider>
      ) : (
        <>{children}</>
      )}
    </>
  );
};

export const GlobalContextProviders = ({
  children,
}: {
  children: ReactNode;
}) => {
  useEffect(() => {
    const existingIcons = document.head.querySelectorAll(
      'link[rel="icon"], link[rel="shortcut icon"]'
    );
    existingIcons.forEach((icon) => icon.remove());

    const newIcon = document.createElement("link");
    newIcon.rel = "icon";
    newIcon.type = "image/png";
    newIcon.href = resolveFileUrl("/_cdn/static/project-icon.png");
    document.head.appendChild(newIcon);
  }, []);

  useEffect(() => {
    const cleanupSW = async () => {
      if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
        try {
          let cleanedUp = false;

          const registrations = await navigator.serviceWorker.getRegistrations();
          for (const registration of registrations) {
            const worker =
              registration.active ?? registration.waiting ?? registration.installing;
            const scriptURL = worker?.scriptURL || "";
            if (!scriptURL.includes("floot-push-sw")) {
              await registration.unregister();
              cleanedUp = true;
            }
          }

          if ("caches" in window) {
            const cacheNames = await caches.keys();
            for (const name of cacheNames) {
              if (name.startsWith("biber-fieber")) {
                await caches.delete(name);
                cleanedUp = true;
              }
            }
          }

          if (cleanedUp) {
            console.log("Service worker and caches cleaned up.");
            try {
              const flag = "sw_cleanup_reloaded";
              if (!sessionStorage.getItem(flag)) {
                sessionStorage.setItem(flag, "true");
                window.location.reload();
              }
            } catch (e) {
              // Ignore sessionStorage errors
            }
          }
        } catch (error) {
          console.error("Failed to cleanup service worker:", error);
        }
      }
    };
    cleanupSW();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeModeProvider>
        <ConnectionQualityProvider>
          <Helmet>
          <meta name="theme-color" content="#2e2e2e" />
          <link rel="manifest" href="/manifest.json" />
          <link rel="icon" type="image/png" href={resolveFileUrl("/_cdn/static/project-icon.png")} />
          <link rel="apple-touch-icon" href={resolveFileUrl("/_cdn/static/project-icon.png")} />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        </Helmet>
        <CookieConsentProvider>
          <ScrollToHashElement />
          <AuthProvider>
            <CartProvider>
              <TooltipProvider>
                <ConsentAwareProviders>
                  {children}
                  <CookieConsent />
                  <SonnerToaster />
                </ConsentAwareProviders>
              </TooltipProvider>
            </CartProvider>
          </AuthProvider>
          </CookieConsentProvider>
        </ConnectionQualityProvider>
      </ThemeModeProvider>
    </QueryClientProvider>
  );
};
import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { isNativeApp } from "./isNativeApp";

export type CookieCategory = "analytics" | "marketing";

export interface CookieConsentState {
  necessary: true; // always true
  analytics: boolean;
  marketing: boolean;
}

export interface CookieConsentContextType {
  consentGiven: boolean;
  consent: CookieConsentState;
  acceptAll: () => void;
  rejectAll: () => void;
  updateConsent: (category: CookieCategory, value: boolean) => void;
  saveConsent: () => void;
  resetConsent: () => void;
  isNativeApp: boolean;
}

const STORAGE_KEY = "biber_cookie_consent";

const defaultConsent: CookieConsentState = {
  necessary: true,
  analytics: false,
  marketing: false,
};

const CookieConsentContext = createContext<CookieConsentContextType | undefined>(undefined);

export const CookieConsentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [consentGiven, setConsentGiven] = useState(false);
  const [consent, setConsent] = useState<CookieConsentState>(defaultConsent);
  const [isNativeState, setIsNativeState] = useState(false);

  // Initialize from localStorage on mount
  useEffect(() => {
    const native = isNativeApp();
    setIsNativeState(native);

    if (native) {
      setConsent({ necessary: true, analytics: true, marketing: true });
      setConsentGiven(true);
      return;
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setConsent({
          necessary: true,
          analytics: !!parsed.analytics,
          marketing: !!parsed.marketing,
        });
        setConsentGiven(!!parsed.consentGiven);
      }
    } catch (e) {
      console.error("Failed to parse cookie consent from localStorage", e);
    }
  }, []);

  const persistConsent = useCallback((newConsent: CookieConsentState, isGiven: boolean) => {
    if (isNativeApp()) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          analytics: newConsent.analytics,
          marketing: newConsent.marketing,
          consentGiven: isGiven,
          timestamp: new Date().toISOString(),
        })
      );
    } catch (e) {
      console.error("Failed to save cookie consent to localStorage", e);
    }
  }, []);

  const acceptAll = useCallback(() => {
    const newConsent: CookieConsentState = { necessary: true, analytics: true, marketing: true };
    setConsent(newConsent);
    setConsentGiven(true);
    persistConsent(newConsent, true);
  }, [persistConsent]);

  const rejectAll = useCallback(() => {
    const newConsent: CookieConsentState = { necessary: true, analytics: false, marketing: false };
    setConsent(newConsent);
    setConsentGiven(true);
    persistConsent(newConsent, true);
  }, [persistConsent]);

  const updateConsent = useCallback((category: CookieCategory, value: boolean) => {
    setConsent((prev) => ({
      ...prev,
      [category]: value,
    }));
  }, []);

  const saveConsent = useCallback(() => {
    setConsentGiven(true);
    persistConsent(consent, true);
  }, [consent, persistConsent]);

  const resetConsent = useCallback(() => {
    setConsentGiven(false);
    setConsent(defaultConsent);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      // ignore
    }
  }, []);

  return (
    <CookieConsentContext.Provider
      value={{
        consentGiven,
        consent,
        acceptAll,
        rejectAll,
        updateConsent,
        saveConsent,
        resetConsent,
        isNativeApp: isNativeState,
      }}
    >
      {children}
    </CookieConsentContext.Provider>
  );
};

export function useCookieConsent() {
  const context = useContext(CookieConsentContext);
  if (context === undefined) {
    throw new Error("useCookieConsent must be used within a CookieConsentProvider");
  }
  return context;
}
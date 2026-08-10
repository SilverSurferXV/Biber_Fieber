import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useProfile } from "./useCustomerApi";
import { translations } from "./translations";

export type SupportedLanguage = "de" | "en" | "es" | "it" | "tr";

let sharedLangOverride: SupportedLanguage | null = null;
const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function getSnapshot() {
  return sharedLangOverride;
}

function setSharedLang(newLang: SupportedLanguage | null) {
  sharedLangOverride = newLang;
  listeners.forEach((listener) => listener());
}

export const useTranslation = () => {
  // It's perfectly safe to call this here; if unauthenticated, the query gracefully fails into 'error' state,
  // returning undefined for profile, which we handle properly below.
  const { data: profile } = useProfile();

  const [localLang, setLocalLang] = useState<SupportedLanguage>("de");

  // Load language preference from localStorage on mount for unauthenticated guests
  useEffect(() => {
    try {
      const stored = localStorage.getItem("biber_language") as SupportedLanguage;
      if (stored && ["de", "en", "es", "it", "tr"].includes(stored)) {
        setLocalLang(stored);
      }
    } catch (error) {
      // Gracefully ignore local storage restrictions (e.g. strict Safari settings)
    }
  }, []);

  const sessionLang = useSyncExternalStore(subscribe, getSnapshot);

  // Compute actual language: database preference first, otherwise fallback to local setting.
  const profileLang = profile?.languagePreference as SupportedLanguage | undefined;
  
  const lang: SupportedLanguage = sessionLang || profileLang || localLang;

  // Sync preference continuously back to localStorage to ensure guests transition 
  // correctly and caching remains intact if network breaks.
  useEffect(() => {
    if (lang && lang !== localLang) {
      try {
        localStorage.setItem("biber_language", lang);
      } catch (error) {
        // Ignored
      }
      setLocalLang(lang);
    }
  }, [lang, localLang]);

  const setLang = useCallback((newLang: SupportedLanguage) => {
    try {
      localStorage.setItem("biber_language", newLang);
    } catch (error) {
      // Ignored
    }
    setLocalLang(newLang);
    setSharedLang(newLang);
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      // Pick current dictionary, fallback to German if something breaks terribly
      const currentLangTranslations = translations[lang] || translations["de"];
      
      // Look up translated key, fallback to German equivalent, then finally to raw string key itself
      let text = currentLangTranslations[key];
      
      if (!text) {
        text = translations["de"][key] || key;
      }

      // Variable substitution for patterns like {amount}, {date}, etc.
      if (params) {
        Object.keys(params).forEach((paramKey) => {
          text = text.replace(
            new RegExp(`{${paramKey}}`, "g"),
            String(params[paramKey])
          );
        });
      }

      return text;
    },
    [lang]
  );

  return { t, lang, setLang };
};
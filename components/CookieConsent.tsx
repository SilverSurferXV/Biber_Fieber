import React, { useState, useEffect } from "react";
import { Button } from "./Button";
import { Switch } from "./Switch";
import { useCookieConsent } from "../helpers/useCookieConsent";
import { useTranslation } from "../helpers/useTranslation";
import { CookieIcon, Settings2Icon } from "lucide-react";
import styles from "./CookieConsent.module.css";

export const CookieConsent: React.FC = () => {
  const { consentGiven, consent, acceptAll, rejectAll, updateConsent, saveConsent, isNativeApp } = useCookieConsent();
  const { t } = useTranslation();
  const [showSettings, setShowSettings] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Prevent hydration mismatch by only rendering after mount
  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted || consentGiven || isNativeApp) {
    return null;
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.banner}>
        {!showSettings ? (
          <div className={styles.mainView}>
            <div className={styles.content}>
              <div className={styles.iconWrapper}>
                <CookieIcon size={24} className={styles.icon} />
              </div>
              <p className={styles.text}>
                {t("cookie.banner_text") || "Wir verwenden Cookies und ähnliche Technologien, um Ihnen die bestmögliche Erfahrung zu bieten."}
              </p>
            </div>
            <div className={styles.actions}>
              <Button onClick={acceptAll} variant="primary" className={styles.button}>
                {t("cookie.accept_all") || "Alle akzeptieren"}
              </Button>
              <Button onClick={rejectAll} variant="outline" className={styles.button}>
                {t("cookie.reject_all") || "Nur notwendige"}
              </Button>
              <Button onClick={() => setShowSettings(true)} variant="ghost" className={styles.settingsButton}>
                <Settings2Icon size={16} />
                {t("cookie.settings") || "Einstellungen"}
              </Button>
            </div>
          </div>
        ) : (
          <div className={styles.settingsView}>
            <h3 className={styles.settingsTitle}>
              {t("cookie.settings") || "Einstellungen"}
            </h3>
            
            <div className={styles.toggleList}>
              <div className={styles.toggleItem}>
                <div className={styles.toggleInfo}>
                  <label className={styles.toggleLabel}>
                    {t("cookie.necessary") || "Notwendig"}
                  </label>
                  <span className={styles.toggleDesc}>
                    {t("cookie.necessary_desc") || "Erforderlich für die Grundfunktionen der Website (immer aktiv)"}
                  </span>
                </div>
                <Switch checked={consent.necessary} disabled />
              </div>

              <div className={styles.toggleItem}>
                <div className={styles.toggleInfo}>
                  <label htmlFor="cookie-analytics" className={styles.toggleLabel}>
                    {t("cookie.analytics") || "Analyse"}
                  </label>
                  <span className={styles.toggleDesc}>
                    {t("cookie.analytics_desc") || "Hilft uns, die Nutzung der Website zu verstehen und zu verbessern"}
                  </span>
                </div>
                <Switch 
                  id="cookie-analytics"
                  checked={consent.analytics} 
                  onCheckedChange={(val) => updateConsent("analytics", val)} 
                />
              </div>

              <div className={styles.toggleItem}>
                <div className={styles.toggleInfo}>
                  <label htmlFor="cookie-marketing" className={styles.toggleLabel}>
                    {t("cookie.marketing") || "Marketing & Push"}
                  </label>
                  <span className={styles.toggleDesc}>
                    {t("cookie.marketing_desc") || "Ermöglicht Push-Benachrichtigungen und personalisierte Inhalte"}
                  </span>
                </div>
                <Switch 
                  id="cookie-marketing"
                  checked={consent.marketing} 
                  onCheckedChange={(val) => updateConsent("marketing", val)} 
                />
              </div>
            </div>

            <div className={styles.settingsActions}>
              <Button onClick={() => setShowSettings(false)} variant="ghost">
                {t('cookie.back')}
              </Button>
              <Button onClick={saveConsent} variant="primary">
                {t("cookie.save") || "Speichern"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
import React, { useState, useEffect } from "react";
import OneSignal from "react-onesignal";
import { Bell, Info, Mail } from "lucide-react";
import { Switch } from "./Switch";
import { toast } from "sonner";
import { useUpdateProfile } from "../helpers/useCustomerApi";
import { useTranslation } from "../helpers/useTranslation";
import styles from "./AccountNotifications.module.css";

export const AccountNotifications = ({ profile }: { profile: any }) => {
  const { t } = useTranslation();
  // Default to true as requested, but we will sync with actual OneSignal state if possible
  const [isOptedIn, setIsOptedIn] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSupported, setIsSupported] = useState<boolean>(true);

  const { mutateAsync: updateProfile, isPending: isUpdatingProfile } = useUpdateProfile();

  useEffect(() => {
    let mounted = true;

    const checkSubscriptionState = async () => {
      try {
        // Slight delay to ensure OneSignal is fully initialized in the global context
        await new Promise((resolve) => setTimeout(resolve, 500));
        
        if (!mounted) return;

        // Check if OneSignal is initialized (react-onesignal provides this)
                // Try to access push subscription - if OneSignal is working, this will succeed
        const optedIn = OneSignal.User?.PushSubscription?.optedIn;
        if (optedIn !== undefined && optedIn !== null) {
          setIsOptedIn(!!optedIn);
          setIsSupported(true);
        } else {
          // optedIn is null/undefined - likely sandbox or not yet initialized
          setIsSupported(false);
        }
      } catch (error) {
        console.warn("Failed to read OneSignal subscription state:", error);
        if (mounted) {
          setIsSupported(false);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    checkSubscriptionState();

    return () => {
      mounted = false;
    };
  }, []);

  const handleToggle = async (checked: boolean) => {
    if (!isSupported) {
      setIsOptedIn(checked);
      toast.info(t("notifications.push_info"));
      return;
    }

    setIsLoading(true);
    try {
      if (checked) {
        // Request permission first if needed
        const permission = OneSignal.Notifications.permission;
        if (!permission) {
          await OneSignal.Notifications.requestPermission();
        }
        await OneSignal.User.PushSubscription.optIn();
        setIsOptedIn(true);
        toast.success(t("notifications.push_enabled"));
      } else {
        await OneSignal.User.PushSubscription.optOut();
        setIsOptedIn(false);
        toast.success(t("notifications.push_disabled"));
      }
    } catch (error) {
      console.error("Error toggling push subscription:", error);
      toast.error(t("notifications.error"));
      // Revert state on error
      setIsOptedIn(!checked);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewsletterToggle = async (checked: boolean) => {
    try {
      await updateProfile({
        newsletterOptIn: checked,
      });
      if (checked) {
        toast.success(t("notifications.newsletter_subscribed"));
      } else {
        toast.success(t("notifications.newsletter_unsubscribed"));
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("notifications.error"));
    }
  };

  return (
    <div className={styles.viewContainer}>
      <div className={styles.notificationCard}>
        <div className={styles.header}>
          <div className={styles.iconBox}>
            <Bell size={20} className={styles.icon} />
          </div>
          <div className={styles.headerText}>
            <h3 className={styles.title}>{t("notifications.push_title")}</h3>
            <p className={styles.description}>
              {t("notifications.push_description")} Diese Option ist <strong style={{textDecoration: 'underline'}}>{t("notifications.default_off")}</strong>.
            </p>
          </div>
        </div>

        <div className={styles.controlRow}>
          <div className={styles.switchInfo}>
            <span className={styles.switchLabel}>
              {isOptedIn ? t("notifications.enabled") : t("notifications.disabled")}
            </span>
          </div>
          <Switch
            id="push-notifications-toggle"
            checked={isOptedIn}
            onCheckedChange={handleToggle}
            disabled={isLoading}
          />
        </div>

        {!isSupported && (
          <div className={styles.infoBanner}>
            <Info size={16} className={styles.infoIcon} />
            <span>
              {t("notifications.push_info")}
            </span>
          </div>
        )}
      </div>

      <div className={styles.notificationCard}>
        <div className={styles.header}>
          <div className={styles.iconBox}>
            <Mail size={20} className={styles.icon} />
          </div>
          <div className={styles.headerText}>
            <h3 className={styles.title}>{t("notifications.newsletter")}</h3>
            <p className={styles.description}>
              {t("notifications.newsletter_description")} Diese Option ist <strong style={{textDecoration: 'underline'}}>{t("notifications.default_off")}</strong>.
            </p>
          </div>
        </div>

        <div className={styles.controlRow}>
          <div className={styles.switchInfo}>
            <span className={styles.switchLabel}>
              {profile?.newsletterOptIn ? t("notifications.enabled") : t("notifications.disabled")}
            </span>
          </div>
          <Switch
            id="newsletter-toggle"
            checked={!!profile?.newsletterOptIn}
            onCheckedChange={handleNewsletterToggle}
            disabled={isUpdatingProfile}
          />
        </div>
      </div>
    </div>
  );
};
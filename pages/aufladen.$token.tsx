import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useTopupHandoffInfo } from '../helpers/useTopupHandoff';
import { useTranslation } from '../helpers/useTranslation';
import { Skeleton } from '../components/Skeleton';
import { Button } from '../components/Button';
import { HandoffTopupCheckout } from '../components/HandoffTopupCheckout';
import styles from './aufladen.$token.module.css';

// The Capacitor native URL scheme for returning to the app
const NATIVE_APP_SCHEME = "app.floot.u5b3d39f96d074ac4a072a41647c58fec://";

export default function AufladenHandoffPage() {
  const { token } = useParams<{ token: string }>();
  const { t } = useTranslation();
  
  const [successCredited, setSuccessCredited] = useState<number | null>(null);

  const { data: info, isLoading, isError, error } = useTopupHandoffInfo(token);

  useEffect(() => {
    if (info?.status === 'completed' && info.pointsCredited && !successCredited) {
      setSuccessCredited(info.pointsCredited);
    }
  }, [info, successCredited]);

  const handleReturnToApp = () => {
    window.open(NATIVE_APP_SCHEME, '_self');
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className={styles.card}>
          <Skeleton style={{ height: '2rem', width: '60%', marginBottom: '1rem' }} />
          <Skeleton style={{ height: '1rem', width: '100%', marginBottom: '0.5rem' }} />
          <Skeleton style={{ height: '1rem', width: '80%', marginBottom: '2rem' }} />
          <Skeleton style={{ height: '10rem', width: '100%' }} />
        </div>
      );
    }

    if (isError || !info) {
      return (
        <div className={styles.card}>
          <h2 className={styles.errorTitle}>{t("handoff.error_title")}</h2>
          <p className={styles.text}>{error?.message || "Token not found"}</p>
        </div>
      );
    }

    if (successCredited !== null) {
      return (
        <div className={styles.card}>
          <h2 className={styles.successTitle}>{t("handoff.success_title")}</h2>
          <p className={styles.text}>
            {t("handoff.success_text", { points: successCredited.toString() })}
          </p>
          <Button onClick={handleReturnToApp} className={styles.backButton}>
            {t("handoff.back_to_app")}
          </Button>
          <p className={styles.hint}>{t("handoff.back_hint")}</p>
        </div>
      );
    }

    if (info.status === 'expired') {
      return (
        <div className={styles.card}>
          <h2 className={styles.errorTitle}>{t("handoff.expired_title")}</h2>
          <p className={styles.text}>{t("handoff.expired_text")}</p>
          <Button onClick={handleReturnToApp} className={styles.backButton}>
            {t("handoff.back_to_app")}
          </Button>
        </div>
      );
    }

    if (info.status === 'completed') {
      return (
        <div className={styles.card}>
          <h2 className={styles.successTitle}>{t("handoff.completed_title")}</h2>
          <p className={styles.text}>{t("handoff.completed_text")}</p>
          <Button onClick={handleReturnToApp} className={styles.backButton}>
            {t("handoff.back_to_app")}
          </Button>
        </div>
      );
    }

    return (
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>{t("handoff.title")}</h1>
          <p className={styles.subtitle}>{t("handoff.subtitle")}</p>
        </div>
        
        <div className={styles.summaryBox}>
          <p className={styles.greeting}>{t("handoff.greeting", { name: info.firstName })}</p>
          
          <div className={styles.amountRow}>
            <span className={styles.label}>{t("handoff.amount_label")}</span>
            <span className={styles.value}>{info.amount.toLocaleString('de-DE')} €</span>
          </div>

          {info.bonusPercent > 0 && (
            <div className={styles.amountRow}>
              <span className={styles.label}>{t("handoff.bonus_label")}</span>
              <span className={styles.bonusValue}>+{info.bonusPercent}%</span>
            </div>
          )}

          <div className={styles.totalRow}>
            <span className={styles.totalLabel}>{t("handoff.credited_label")}</span>
            <span className={styles.totalValue}>
              {info.pointsToCredit.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className={styles.checkoutWrapper}>
          <HandoffTopupCheckout
            token={token!}
            amount={info.amount}
            bonusPercent={info.bonusPercent}
            pointsToCredit={info.pointsToCredit}
            onSuccess={() => setSuccessCredited(info.pointsToCredit)}
          />
        </div>
      </div>
    );
  };

  return (
    <div className={styles.page}>
      <Helmet>
        <title>{t("handoff.page_title")}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      
      <div className={styles.container}>
        {renderContent()}
      </div>
    </div>
  );
}
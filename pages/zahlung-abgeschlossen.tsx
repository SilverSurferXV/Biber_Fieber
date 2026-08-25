import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Button } from '../components/Button';
import { useTranslation } from '../helpers/useTranslation';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle, XCircle, Clock } from 'lucide-react';
import { Spinner } from '../components/Spinner';
import { postCompleteRedirectTopup } from '../endpoints/wallet/redirect-payment/complete_POST.schema';
import styles from './zahlung-abgeschlossen.module.css';

export default function ZahlungAbgeschlossen() {
  const { t } = useTranslation();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const redirectStatus = searchParams.get('redirect_status');
  const paymentIntent = searchParams.get('payment_intent');

  const nativeScheme = 'com.silversurfer.biberfieber://';

  const [pollCount, setPollCount] = useState(0);

  const { data, isPending: isQueryPending, isError } = useQuery({
    queryKey: ['completeRedirectTopup', paymentIntent],
    queryFn: async () => {
      setPollCount((c) => c + 1);
      return await postCompleteRedirectTopup({ paymentIntentId: paymentIntent! });
    },
    enabled: !!paymentIntent && pollCount < 10,
    refetchInterval: (query) => {
      if (pollCount >= 10) return false;
      const d = query.state.data;
      if (d && (d.status === 'processing' || d.status === 'requires_action')) {
        return 3000;
      }
      return false;
    },
  });

  const isChecking =
    !!paymentIntent &&
    (isQueryPending ||
      (data && (data.status === 'processing' || data.status === 'requires_action') && pollCount < 10));

  let isSuccess = false;
  let isFailed = false;
  let isPendingState = false;

  if (paymentIntent) {
    if (!isChecking) {
      if (data?.credited || data?.alreadyCredited || data?.status === 'succeeded') {
        isSuccess = true;
      } else if (
        isError ||
        data?.status === 'canceled' ||
                data?.status === 'requires_payment_method'
      ) {
        isFailed = true;
      } else {
        isPendingState = true;
      }
    }
  } else {
    isSuccess = redirectStatus === 'succeeded';
    isFailed = redirectStatus === 'failed';
    isPendingState = !isSuccess && !isFailed;
  }

  return (
    <div className={styles.container}>
      <Helmet>
        <title>{`${t('payment_return.title', { defaultValue: 'Zahlung' })} | Biber Fieber`}</title>
      </Helmet>
      
      <div className={styles.card}>
        {isChecking && (
          <>
            <div className={styles.checkingIcon}>
              <Spinner size="lg" />
            </div>
            <h1 className={styles.title}>
              {t('payment_return.checking_title', { defaultValue: 'Zahlung wird geprüft' })}
            </h1>
            <p className={styles.description}>
              {t('payment_return.checking_desc', {
                defaultValue: 'Bitte warte einen Moment, während wir deine Zahlung bestätigen...',
              })}
            </p>
          </>
        )}

        {isSuccess && (
          <>
            <CheckCircle className={styles.successIcon} size={64} />
            <h1 className={styles.title}>
              {t('payment_return.success_title', { defaultValue: 'Zahlung erfolgreich!' })}
            </h1>
            <p className={styles.description}>
              {t('payment_return.success_desc', {
                defaultValue:
                  'Deine Zahlung wurde bestätigt. Das Guthaben wird in wenigen Momenten in der App gutgeschrieben.',
              })}
              {data?.pointsCredited ? (
                <>
                  <br />
                  <br />
                  {t('payment_return.points_credited', {
                    defaultValue: 'Es wurden {points} Punkte gutgeschrieben!',
                    points: data.pointsCredited,
                  })}
                </>
              ) : null}
            </p>
          </>
        )}

                {isFailed && (
          <>
            <XCircle className={styles.errorIcon} size={64} />
            <h1 className={styles.title}>
              {t('payment_return.failed_title', { defaultValue: 'Zahlung fehlgeschlagen' })}
            </h1>
            <p className={styles.description}>
              {t('payment_return.failed_desc', { defaultValue: 'Leider konnte deine Zahlung nicht verarbeitet werden. Bitte versuche es in der App erneut.' })}
                        </p>
          </>
        )}

        {isPendingState && (
          <>
            <Clock className={styles.pendingIcon} size={64} />
            <h1 className={styles.title}>
              {t('payment_return.pending_title', { defaultValue: 'Zahlung in Bearbeitung' })}
            </h1>
            <p className={styles.description}>
              {t('payment_return.pending_desc', { defaultValue: 'Deine Zahlung wird derzeit verarbeitet. Du kannst dieses Fenster nun schließen und zur App zurückkehren.' })}
            </p>
          </>
        )}

        <div className={styles.actions}>
          <Button asChild size="lg" className={styles.primaryBtn}>
            <a href={nativeScheme}>
              {t('payment_return.back_to_app', { defaultValue: 'Zur App zurückkehren' })}
            </a>
          </Button>
          
          <Button asChild variant="ghost" className={styles.secondaryBtn}>
            <Link to="/account?tab=guthaben">
              {t('payment_return.back_to_web', { defaultValue: 'Weiter im Web' })}
            </Link>
          </Button>
        </div>
      </div>
    </div>);

}
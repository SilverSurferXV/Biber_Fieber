import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { STRIPE_PUBLISHABLE_KEY } from '../helpers/_publicConfigs';
import { useCreateHandoffIntent, useConfirmHandoffTopup } from '../helpers/useTopupHandoff';
import { paymentMethodSchema } from '../endpoints/wallet/create-payment-intent_POST.schema';
import { WalletExpressCheckout } from './WalletExpressCheckout';
import { TopupCardForm } from './TopupCardForm';
import { Skeleton } from './Skeleton';
import { Button } from './Button';
import { useTranslation } from '../helpers/useTranslation';
import styles from './HandoffTopupCheckout.module.css';

const stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);

interface Props {
  token: string;
  amount: number;
  bonusPercent: number;
  pointsToCredit: number;
  onSuccess: (pointsCredited: number) => void;
}

const reportDiagnostic = (outcomeSource: string, rawMethods?: any, legacyProbeResult?: any) => {
  try {
    let applePaySessionExists = false;
    let canMakePayments = null;
    let supportsVersion3 = null;

    if (typeof window !== 'undefined' && (window as any).ApplePaySession) {
      applePaySessionExists = true;
      try {
        canMakePayments = (window as any).ApplePaySession.canMakePayments();
      } catch (e) {}
      try {
        supportsVersion3 = (window as any).ApplePaySession.supportsVersion(3);
      } catch (e) {}
    }

    const isIframe = typeof window !== 'undefined' && window.self !== window.top;

    const diagnostic = {
      message: "handoff wallet availability",
      outcomeSource,
      availablePaymentMethods: rawMethods || null,
       applePaySessionExists,
       canMakePayments,
       supportsVersion3,
      context: {
        origin: typeof window !== 'undefined' ? window.location.origin : null,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        legacyProbeResult,
        stripeKeyPrefix: STRIPE_PUBLISHABLE_KEY.substring(0, 8),
      },
       isIframe,
     };

    navigator.sendBeacon(
      "/_api/diagnostics/client-error",
      new Blob([JSON.stringify(diagnostic)], { type: "text/plain" })
    );
  } catch (e) {
    // Ignore
  }
};

 export const HandoffTopupCheckout = ({ token, amount, pointsToCredit, onSuccess }: Props) => {
   const { t } = useTranslation();
  const intentCreatedRef = React.useRef(false);
   const [clientSecret, setClientSecret] = useState('');
   const [paymentIntentId, setPaymentIntentId] = useState('');
   const [intentError, setIntentError] = useState<string | null>(null);
  
  const { mutateAsync: createIntent, isPending: isCreatingIntent } = useCreateHandoffIntent();
  const { mutateAsync: confirmHandoff } = useConfirmHandoffTopup();

  const [walletsAvailable, setWalletsAvailable] = useState<boolean | null>(null);
  const diagnosticReportedRef = React.useRef(false);
  const legacyProbeResultRef = React.useRef<any>(undefined);

  useEffect(() => {
    stripePromise.then(stripe => {
      if (!stripe) return;
      try {
        const pr = stripe.paymentRequest({
          country: 'DE',
          currency: 'eur',
          total: {
            label: 'Guthaben',
            amount: Math.round(amount * 100),
          },
        });
        pr.canMakePayment().then(res => {
          legacyProbeResultRef.current = res;
        }).catch(e => {
          legacyProbeResultRef.current = { error: String(e) };
        });
      } catch (e) {
        legacyProbeResultRef.current = { error: String(e) };
      }
    });
  }, [amount]);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    if (clientSecret && walletsAvailable === null) {
      timeout = setTimeout(() => {
        setWalletsAvailable(false);
        if (!diagnosticReportedRef.current) {
          diagnosticReportedRef.current = true;
          reportDiagnostic("timeout", undefined, legacyProbeResultRef.current);
        }
      }, 12000);
    }
    return () => clearTimeout(timeout);
  }, [clientSecret, walletsAvailable]);

  useEffect(() => {
     if (token && !clientSecret && !intentError) {
       createIntent({ token })
         .then(res => {
          if (intentCreatedRef.current) return;
          intentCreatedRef.current = true;
           setClientSecret(res.clientSecret);
           setPaymentIntentId(res.paymentIntentId);
         })
         .catch(err => {
          if (intentCreatedRef.current) return;
           setIntentError(err.message || "Failed to create intent");
         });
     }
  }, [token, clientSecret, intentError, createIntent, intentCreatedRef]);

  const handleCreditPayment = async (args: { paymentIntentId: string; paymentMethod: string }) => {
        const paymentMethod = paymentMethodSchema.parse(args.paymentMethod);
    return await confirmHandoff({ token, paymentIntentId: args.paymentIntentId, paymentMethod });
  };

  if (intentError) {
    return (
      <div className={styles.errorContainer}>
        <p className={styles.errorText}>{intentError}</p>
        <Button variant="outline" onClick={() => setIntentError(null)}>
          {t("topup.retry")}
        </Button>
      </div>
    );
  }

  if (!clientSecret) {
    return <Skeleton className={styles.loadingSkeleton} />;
  }
  
  const returnUrl = typeof window !== 'undefined' ? window.location.href : undefined;

  return (
    <div className={styles.container}>
      {walletsAvailable !== false ? (
        <div className={styles.walletSection}>
          <h4 className={styles.sectionTitle}>{t("topup.wallets_title")}</h4>
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <WalletExpressCheckout 
              amount={amount}
              paymentIntentId={paymentIntentId}
              onReady={(available, methods) => {
                setWalletsAvailable(available);
                if (!diagnosticReportedRef.current) {
                  diagnosticReportedRef.current = true;
                  reportDiagnostic("onReady", methods, legacyProbeResultRef.current);
                }
              }}
              onLoadError={(error) => {
                setWalletsAvailable(false);
                if (!diagnosticReportedRef.current) {
                  diagnosticReportedRef.current = true;
                  const errObj = error && typeof error === 'object' ? { message: error.message, type: error.type, code: error.code } : String(error);
                  reportDiagnostic("onLoadError", { error: errObj }, legacyProbeResultRef.current);
                }
              }}
              onSuccess={() => onSuccess(pointsToCredit)}
              creditPayment={handleCreditPayment}
              returnUrl={returnUrl}
            />
          </Elements>
        </div>
      ) : (
        <div className={styles.walletUnavailableHint}>
          {(() => {
            let applePaySessionExists = false;
            let canMakePayments = false;
            try {
              if (typeof window !== 'undefined' && (window as any).ApplePaySession) {
                applePaySessionExists = true;
                canMakePayments = (window as any).ApplePaySession.canMakePayments();
              }
            } catch (e) {}

            if (applePaySessionExists && canMakePayments) {
              return t("handoff.wallets_unavailable_apple_pay_no_card");
            } else if (!applePaySessionExists) {
              return t("handoff.wallets_unavailable_browser");
            }
            return t("handoff.wallets_unavailable");
          })()}
        </div>
      )}

      <div className={styles.divider}>
        <span className={styles.dividerText}>{t("topup.or_other")}</span>
      </div>

      <div className={styles.cardSection}>
        <h4 className={styles.sectionTitle}>{t("topup.cc")}</h4>
        <Elements stripe={stripePromise} options={{ clientSecret }}>
          <TopupCardForm 
            amount={amount}
            paymentMethod="credit_card"
            paymentIntentId={paymentIntentId}
            onSuccess={() => onSuccess(pointsToCredit)}
            creditPayment={handleCreditPayment}
            returnUrl={returnUrl}
          />
        </Elements>
      </div>
    </div>
  );
};
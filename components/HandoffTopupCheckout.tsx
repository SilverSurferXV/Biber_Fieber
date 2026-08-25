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

export const HandoffTopupCheckout = ({ token, amount, pointsToCredit, onSuccess }: Props) => {
  const { t } = useTranslation();
  const [clientSecret, setClientSecret] = useState('');
  const [paymentIntentId, setPaymentIntentId] = useState('');
  const [intentError, setIntentError] = useState<string | null>(null);
  
  const { mutateAsync: createIntent, isPending: isCreatingIntent } = useCreateHandoffIntent();
  const { mutateAsync: confirmHandoff } = useConfirmHandoffTopup();

  const [walletsAvailable, setWalletsAvailable] = useState<boolean | null>(null);
  const [showCardForm, setShowCardForm] = useState(false);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    if (clientSecret && walletsAvailable === null && !showCardForm) {
      timeout = setTimeout(() => {
        setWalletsAvailable(false);
        setShowCardForm(true);
      }, 5000);
    }
    return () => clearTimeout(timeout);
  }, [clientSecret, walletsAvailable, showCardForm]);

  useEffect(() => {
    if (token && !clientSecret && !intentError) {
      createIntent({ token })
        .then(res => {
          setClientSecret(res.clientSecret);
          setPaymentIntentId(res.paymentIntentId);
        })
        .catch(err => {
          setIntentError(err.message || "Failed to create intent");
        });
    }
  }, [token, clientSecret, intentError, createIntent]);

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
      {walletsAvailable !== false && !showCardForm && (
        <div className={styles.walletSection}>
          <h4 className={styles.sectionTitle}>{t("topup.wallets_title")}</h4>
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <WalletExpressCheckout 
              amount={amount}
              paymentIntentId={paymentIntentId}
              onReady={(available) => {
                setWalletsAvailable(available);
                if (!available) {
                  setShowCardForm(true);
                }
              }}
              onSuccess={() => onSuccess(pointsToCredit)}
              creditPayment={handleCreditPayment}
              returnUrl={returnUrl}
            />
          </Elements>
        </div>
      )}

      {walletsAvailable !== false && !showCardForm && (
        <div className={styles.divider}>
          <Button variant="link" onClick={() => setShowCardForm(true)}>
            {t("handoff.card_toggle")}
          </Button>
        </div>
      )}

      {showCardForm && (
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
      )}
    </div>
  );
};
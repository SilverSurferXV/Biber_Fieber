import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './Dialog';
import { Button } from './Button';
import { CreditCard, Wallet, BadgeEuro, ShoppingBag, ExternalLink, RefreshCw } from 'lucide-react';
import { isNativeApp } from '../helpers/isNativeApp';
import { useStartRedirectTopup, useRedirectTopupStatus } from '../helpers/useRedirectTopup';
import { Spinner } from './Spinner';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { STRIPE_PUBLISHABLE_KEY, PAYPAL_CLIENT_ID } from '../helpers/_publicConfigs';
import { useCreatePaymentIntent } from '../helpers/useStripeTopup';
import { useCreatePaypalOrder, useCapturePaypalOrder } from '../helpers/usePaypalTopup';
import { useTranslation } from '../helpers/useTranslation';
import { toast } from 'sonner';
import { TopupCardForm } from './TopupCardForm';
import styles from './TopupPaymentDialog.module.css';

const stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);

const PayPalCheckoutForm = ({ 
  amount, 
  onSuccess, 
  onCancel 
}: { 
  amount: number, 
  onSuccess: () => void, 
  onCancel: () => void 
}) => {
  const { t } = useTranslation();
  const { mutateAsync: createOrder, isPending: isCreating } = useCreatePaypalOrder();
  const { mutateAsync: captureOrder, isPending: isCapturing } = useCapturePaypalOrder();
  
  const isPending = isCreating || isCapturing;

  return (
    <div className={styles.paypalContainer}>
      <PayPalScriptProvider options={{ clientId: PAYPAL_CLIENT_ID, currency: "EUR", intent: "capture" }}>
        <PayPalButtons
          style={{ layout: "vertical", color: "gold", shape: "rect", label: "paypal" }}
          createOrder={async () => {
            const res = await createOrder({ amount: amount as any });
            return res.orderId;
          }}
          onApprove={async (data) => {
            try {
              const res = await captureOrder({ orderId: data.orderID, amount: amount as any });
              toast.success(t("topup.success", { points: res.pointsCredited }));
              onSuccess();
            } catch (err: any) {
              toast.error(err.message || t("topup.failed"));
            }
          }}
          onError={() => {
            toast.error(t("topup.failed"));
          }}
          disabled={isPending}
        />
      </PayPalScriptProvider>
      <div className={styles.paypalActions}>
        <Button variant="outline" type="button" onClick={onCancel} disabled={isPending}>
          {t("topup.cancel")}
        </Button>
      </div>
    </div>
  );
};

export const TopupPaymentDialog = ({ 
  isOpen, 
  onClose, 
  amount 
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  amount: number 
}) => {
  const { t } = useTranslation();
  const [step, setStep] = useState<'select' | 'payment' | 'paypal' | 'external'>('select');
  const [redirectUrl, setRedirectUrl] = useState<string>('');
  
  const PaymentMethods = [
    { id: 'klarna', label: 'Klarna', icon: BadgeEuro },
    { id: 'klarna_sofort', label: t("topup.sofort"), icon: BadgeEuro },
    { id: 'paypal', label: 'PayPal', icon: Wallet },
    { id: 'amazon_pay', label: 'Amazon Pay', icon: ShoppingBag },
    { id: 'credit_card', label: t("topup.cc"), icon: CreditCard },
  ];
  
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [clientSecret, setClientSecret] = useState<string>('');
  const [paymentIntentId, setPaymentIntentId] = useState<string>('');
  
  const { mutateAsync: createIntent, isPending: isCreatingIntent } = useCreatePaymentIntent();
  const { mutateAsync: startRedirectTopup, isPending: isStartingRedirect } = useStartRedirectTopup();

  const statusQuery = useRedirectTopupStatus({
    paymentIntentId,
    amount: amount as any,
    paymentMethod,
    enabled: step === 'external',
  });

  useEffect(() => {
    if (step !== 'external' || !statusQuery.data) return;
    const { status, pointsCredited } = statusQuery.data;
    if (status === 'succeeded') {
      if (pointsCredited !== null) {
        toast.success(t("topup.success", { points: pointsCredited }));
      } else {
        toast.success(t("topup.external.credited"));
      }
      handleClose();
    } else if (status === 'canceled' || status === 'requires_payment_method') {
      toast.error(t("topup.external.failed"));
      setStep('select');
    }
  }, [statusQuery.data, step]);

  const handleSelectMethod = async (method: string) => {
    setPaymentMethod(method);
    
    const isRedirectMethod = ['klarna', 'klarna_sofort', 'amazon_pay'].includes(method);
    if (isNativeApp() && isRedirectMethod) {
      try {
        const res = await startRedirectTopup({ amount: amount as any, paymentMethod: method as any });
        setPaymentIntentId(res.paymentIntentId);
        setRedirectUrl(res.redirectUrl);
        setStep('external');
        
        const newWindow = window.open(res.redirectUrl, "_blank");
        if (!newWindow) {
          toast.error(t("topup.external.popup_blocked"));
        }
      } catch (e: any) {
        toast.error(e.message);
      }
      return;
    }

    if (method === 'paypal') {
      setStep('paypal');
      return;
    }

    try {
      const res = await createIntent({ amount: amount as any, paymentMethod: method as any });
      setClientSecret(res.clientSecret);
      setPaymentIntentId(res.paymentIntentId);
      setStep('payment');
    } catch(e: any) {
      toast.error(e.message);
    }
  };

  const handleClose = () => {
    setStep('select');
    setPaymentMethod('');
    setClientSecret('');
    setPaymentIntentId('');
    setRedirectUrl('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("topup.title", { amount })}</DialogTitle>
          <DialogDescription>
            {step === 'select' ? t("topup.subtitle") : t("topup.complete")}
          </DialogDescription>
        </DialogHeader>
        
        {step === 'select' && (
          <div className={styles.methodGrid}>
            {PaymentMethods.map(m => (
              <button 
                key={m.id} 
                className={styles.methodCard} 
                onClick={() => handleSelectMethod(m.id)}
                disabled={isCreatingIntent || isStartingRedirect}
                type="button"
              >
                <m.icon size={24} className={styles.methodIcon} />
                <span>{m.label}</span>
              </button>
            ))}
          </div>
        )}

        {step === 'payment' && clientSecret && (
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <TopupCardForm 
              amount={amount}
              paymentMethod={paymentMethod}
              paymentIntentId={paymentIntentId}
              onSuccess={handleClose}
              onCancel={handleClose}
            />
          </Elements>
        )}

        {step === 'paypal' && (
          <PayPalCheckoutForm 
            amount={amount}
            onSuccess={handleClose}
            onCancel={handleClose}
          />
        )}

        {step === 'external' && (
          <div className={styles.externalContainer}>
            <div className={styles.externalIconWrapper}>
              <Spinner size="lg" />
            </div>
            <p className={styles.externalDescription}>
              {t("topup.external.description", { 
                provider: paymentMethod === 'amazon_pay' ? 'Amazon Pay' : 
                          paymentMethod === 'klarna_sofort' ? t("topup.sofort") : 'Klarna' 
              })}
            </p>
            <p className={styles.externalWaiting}>
              {t("topup.external.waiting")}
            </p>
            {redirectUrl && (
              <Button variant="outline" className={styles.externalReopen} onClick={() => window.open(redirectUrl, "_blank")}>
                <ExternalLink size={16} />
                {t("topup.external.reopen")}
              </Button>
            )}
            <div className={styles.externalActions}>
              <Button variant="ghost" onClick={() => setStep('select')}>
                {t("topup.cancel")}
              </Button>
              <Button onClick={() => statusQuery.refetch()} disabled={statusQuery.isFetching}>
                <RefreshCw size={16} className={statusQuery.isFetching ? styles.spin : ''} />
                {statusQuery.isFetching ? t("topup.external.checking") : t("topup.external.check")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
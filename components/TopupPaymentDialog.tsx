import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './Dialog';
import { Button } from './Button';
import { CreditCard, Smartphone, Wallet, BadgeEuro } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { STRIPE_PUBLISHABLE_KEY, PAYPAL_CLIENT_ID } from '../helpers/_publicConfigs';
import { useCreatePaymentIntent, useConfirmTopup } from '../helpers/useStripeTopup';
import { useCreatePaypalOrder, useCapturePaypalOrder } from '../helpers/usePaypalTopup';
import { useTranslation } from '../helpers/useTranslation';
import { toast } from 'sonner';
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

const CheckoutForm = ({ 
  amount, 
  paymentMethod, 
  paymentIntentId, 
  onSuccess, 
  onCancel 
}: { 
  amount: number, 
  paymentMethod: string, 
  paymentIntentId: string, 
  onSuccess: () => void, 
  onCancel: () => void 
}) => {
  const { t } = useTranslation();
  const stripe = useStripe();
  const elements = useElements();
  const { mutateAsync: confirmTopup, isPending } = useConfirmTopup();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/account?tab=guthaben&payment_intent=${paymentIntentId}&topup_amount=${amount}&topup_method=${paymentMethod}`,
      },
      redirect: 'if_required'
    });

    if (error) {
      toast.error(error.message || t("topup.failed"));
      setIsProcessing(false);
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      try {
        const res = await confirmTopup({
          paymentIntentId: paymentIntent.id,
          amount: amount as any,
          paymentMethod: paymentMethod as any
        });
        toast.success(t("topup.success", { points: res.pointsCredited }));
        onSuccess();
      } catch(err: any) {
        toast.error(err.message);
        setIsProcessing(false);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <PaymentElement />
      <div className={styles.actions}>
        <Button variant="outline" type="button" onClick={onCancel} disabled={isProcessing || isPending}>
          {t("topup.cancel")}
        </Button>
        <Button type="submit" disabled={!stripe || isProcessing || isPending}>
          {isProcessing || isPending ? t("topup.processing") : t("topup.pay", { amount })}
        </Button>
      </div>
    </form>
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
  const [step, setStep] = useState<'select' | 'payment' | 'paypal'>('select');
  
  const PaymentMethods = [
    { id: 'gpay', label: 'Google Pay', icon: Smartphone },
    { id: 'apple_pay', label: 'Apple Pay', icon: Smartphone },
    { id: 'klarna', label: 'Klarna', icon: BadgeEuro },
    { id: 'klarna_sofort', label: t("topup.sofort"), icon: BadgeEuro },
    { id: 'paypal', label: 'PayPal', icon: Wallet },
    { id: 'credit_card', label: t("topup.cc"), icon: CreditCard },
  ];
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [clientSecret, setClientSecret] = useState<string>('');
  const [paymentIntentId, setPaymentIntentId] = useState<string>('');
  
  const { mutateAsync: createIntent, isPending } = useCreatePaymentIntent();

  const handleSelectMethod = async (method: string) => {
    setPaymentMethod(method);
    
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
                disabled={isPending}
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
            <CheckoutForm 
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
      </DialogContent>
    </Dialog>
  );
};
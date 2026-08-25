import React, { useState } from 'react';
import { Button } from './Button';
import { PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useConfirmTopup } from '../helpers/useStripeTopup';
import { useTranslation } from '../helpers/useTranslation';
import { toast } from 'sonner';
import styles from './TopupCardForm.module.css';

export interface TopupCardFormProps {
  amount: number;
  paymentMethod: string;
  paymentIntentId: string;
  onSuccess: (res?: { pointsCredited: number }) => void;
  onCancel?: () => void;
  creditPayment?: (args: { paymentIntentId: string; paymentMethod: string }) => Promise<{ pointsCredited: number }>;
  returnUrl?: string;
}

export const TopupCardForm = ({ 
  amount, 
  paymentMethod, 
  paymentIntentId, 
  onSuccess, 
  onCancel,
  creditPayment,
  returnUrl
}: TopupCardFormProps) => {
  const { t } = useTranslation();
  const stripe = useStripe();
  const elements = useElements();
  const { mutateAsync: confirmTopup, isPending } = useConfirmTopup();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);
    
    const defaultReturnUrl = `${window.location.origin}/account?tab=guthaben&payment_intent=${paymentIntentId}&topup_amount=${amount}&topup_method=${paymentMethod}`;

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: returnUrl || defaultReturnUrl,
      },
      redirect: 'if_required'
    });

    if (error) {
      toast.error(error.message || t("topup.failed"));
      setIsProcessing(false);
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      try {
        const res = creditPayment 
          ? await creditPayment({ paymentIntentId: paymentIntent.id, paymentMethod })
          : await confirmTopup({
              paymentIntentId: paymentIntent.id,
              amount: amount as any,
              paymentMethod: paymentMethod as any
            });
            
        toast.success(t("topup.success", { points: res.pointsCredited }));
        onSuccess(res);
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
        {onCancel && (
          <Button variant="outline" type="button" onClick={onCancel} disabled={isProcessing || isPending}>
            {t("topup.cancel")}
          </Button>
        )}
        <Button type="submit" disabled={!stripe || isProcessing || isPending}>
          {isProcessing || isPending ? t("topup.processing") : t("topup.pay", { amount })}
        </Button>
      </div>
    </form>
  );
};
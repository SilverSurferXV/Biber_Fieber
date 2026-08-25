import React, { useState } from 'react';
import { ExpressCheckoutElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { StripeExpressCheckoutElementReadyEvent, StripeExpressCheckoutElementConfirmEvent } from '@stripe/stripe-js';
import { useConfirmTopup } from '../helpers/useStripeTopup';
import { useTranslation } from '../helpers/useTranslation';
import { toast } from 'sonner';
import styles from './TopupPaymentDialog.module.css';

 interface WalletExpressCheckoutProps {
   amount: number;
   paymentIntentId: string;
   onSuccess: () => void;
   onReady: (available: boolean, methods?: any) => void;
   onLoadError?: (error: any) => void;
  creditPayment?: (args: { paymentIntentId: string; paymentMethod: string }) => Promise<{ pointsCredited: number }>;
  returnUrl?: string;
 }
 
 export const WalletExpressCheckout = ({
   amount,
   paymentIntentId,
   onSuccess,
  onReady,
  onLoadError,
  creditPayment,
  returnUrl
 }: WalletExpressCheckoutProps) => {
  const { t } = useTranslation();
  const stripe = useStripe();
  const elements = useElements();
  const { mutateAsync: confirmTopup, isPending } = useConfirmTopup();
  const [isProcessing, setIsProcessing] = useState(false);

  const mapExpressPaymentType = (expressPaymentType?: string): string => {
    if (expressPaymentType === 'apple_pay') return 'apple_pay';
    if (expressPaymentType === 'google_pay') return 'gpay';
    return 'credit_card';
  };

  const handleConfirm = async (event: StripeExpressCheckoutElementConfirmEvent) => {
    if (!stripe || !elements) return;

    setIsProcessing(true);

     const expressPaymentType = event.expressPaymentType;
     const mappedMethod = mapExpressPaymentType(expressPaymentType);
 
    const defaultReturnUrl = `${window.location.origin}/account?tab=guthaben&payment_intent=${paymentIntentId}&topup_amount=${amount}&topup_method=${mappedMethod}`;
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
          ? await creditPayment({
              paymentIntentId: paymentIntent.id,
              paymentMethod: mappedMethod,
            })
          : await confirmTopup({
           paymentIntentId: paymentIntent.id,
           amount: amount as any,
           paymentMethod: mappedMethod as any
        });
        toast.success(t("topup.success", { points: res.pointsCredited }));
        onSuccess();
      } catch (err: any) {
        toast.error(err.message);
        setIsProcessing(false);
      }
    }
  };

  return (
    <>
    <ExpressCheckoutElement
      options={{
        paymentMethods: {
          link: 'never',
          paypal: 'never',
          amazonPay: 'never'
        },
        buttonHeight: 48,
        layout: { overflow: 'never' }
      }}
      onReady={(event: StripeExpressCheckoutElementReadyEvent) => {
        const methods = event.availablePaymentMethods;
        const available = !!(methods && Object.values(methods).some(Boolean));
        onReady(available, methods);
      }}
      onLoadError={(error) => {
        if (onLoadError) onLoadError(error);
      }}
      onConfirm={handleConfirm}
      onCancel={() => {
        setIsProcessing(false);
      }}
    />
    {isProcessing && (
      <div className={styles.processingText}>
        {t("topup.processing")}
      </div>
    )}
    </>
  );
};
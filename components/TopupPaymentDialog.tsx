import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './Dialog';
import { Button } from './Button';
import { CreditCard, Wallet, BadgeEuro } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { STRIPE_PUBLISHABLE_KEY, PAYPAL_CLIENT_ID } from '../helpers/_publicConfigs';
import { useCreatePaymentIntent, useConfirmTopup } from '../helpers/useStripeTopup';
import { useCreatePaypalOrder, useCapturePaypalOrder } from '../helpers/usePaypalTopup';
import { useTranslation } from '../helpers/useTranslation';
import { toast } from 'sonner';
import { Skeleton } from './Skeleton';
import { WalletExpressCheckout } from './WalletExpressCheckout';
import { TopupCardForm } from './TopupCardForm';
import { isNativeApp } from '../helpers/isNativeApp';
import { nativeStripeWallet } from '../helpers/nativeStripeWallet';
import { useCreateTopupHandoff } from '../helpers/useTopupHandoff';
import { getHandoffInfo } from '../endpoints/wallet/handoff/info_GET.schema';
import { useQueryClient } from '@tanstack/react-query';
import { AUTH_QUERY_KEY } from '../helpers/useAuth';
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
  const [step, setStep] = useState<'select' | 'payment' | 'paypal'>('select');
  
  const PaymentMethods = [
    { id: 'klarna', label: 'Klarna', icon: BadgeEuro },
    { id: 'klarna_sofort', label: t("topup.sofort"), icon: BadgeEuro },
    { id: 'paypal', label: 'PayPal', icon: Wallet },
    { id: 'credit_card', label: t("topup.cc"), icon: CreditCard },
  ];
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [clientSecret, setClientSecret] = useState<string>('');
  const [paymentIntentId, setPaymentIntentId] = useState<string>('');
  const [walletsAvailable, setWalletsAvailable] = useState<boolean | null>(null);
  const [intentError, setIntentError] = useState<string | null>(null);

  const [nativeWalletAvailability, setNativeWalletAvailability] = useState<{ applePay: boolean; googlePay: boolean; pluginAvailable: boolean } | null>(null);
  const [isNativeWalletProcessing, setIsNativeWalletProcessing] = useState(false);
  const { mutateAsync: confirmTopup } = useConfirmTopup();

  const queryClient = useQueryClient();
  const { mutateAsync: createHandoff, isPending: isCreatingHandoff } = useCreateTopupHandoff();
  const [handoffToken, setHandoffToken] = useState<string | null>(null);
  const [isWaitingHandoff, setIsWaitingHandoff] = useState(false);
  const [isCheckingHandoff, setIsCheckingHandoff] = useState(false);

  const checkHandoffStatus = async () => {
    if (!handoffToken) return;
    setIsCheckingHandoff(true);
    try {
      const info = await queryClient.fetchQuery({
        queryKey: ["topup-handoff", handoffToken],
        queryFn: () => getHandoffInfo({ token: handoffToken }),
      });
      if (info.status === 'completed') {
        toast.success(t("topup.success", { points: info.pointsCredited || 0 }));
        queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
        handleClose();
      } else {
        toast.info(t("topup.wallet_app_not_completed"));
      }
    } catch (err: any) {
      toast.error(err.message || t("topup.wallet_app_failed"));
    } finally {
      setIsCheckingHandoff(false);
    }
  };

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && isWaitingHandoff) {
        checkHandoffStatus();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isWaitingHandoff, handoffToken]);

  useEffect(() => {
    if (isNativeApp() && isOpen && nativeWalletAvailability === null) {
      nativeStripeWallet.getAvailability().then(avail => {
        setNativeWalletAvailability(avail);
      }).catch(err => {
        console.error("Failed to check native wallet availability", err);
        setNativeWalletAvailability({ applePay: false, googlePay: false, pluginAvailable: false });
      });
    }
  }, [isOpen, nativeWalletAvailability]);

  const handleNativeWalletPay = async (kind: "apple_pay" | "google_pay") => {
    setIsNativeWalletProcessing(true);
    try {
      const res = await createIntent({ amount: amount as any, paymentMethod: 'credit_card' as any });
      const payResult = await nativeStripeWallet.pay({
        kind,
        clientSecret: res.clientSecret,
        amount,
        label: t("topup.wallet_native_label"),
      });

      if (payResult === "completed") {
        const confirmRes = await confirmTopup({
          paymentIntentId: res.paymentIntentId,
          amount: amount as any,
          paymentMethod: kind === "apple_pay" ? "apple_pay" : "gpay",
        });
        toast.success(t("topup.success", { points: confirmRes.pointsCredited }));
        handleClose();
      } else if (payResult === "canceled") {
        toast.info(t("topup.wallet_native_canceled"));
      } else {
        toast.error(t("topup.wallet_native_failed"));
      }
    } catch (err: any) {
      console.error("Native wallet pay error:", err);
      toast.error(err.message || t("topup.wallet_native_failed"));
    } finally {
      setIsNativeWalletProcessing(false);
    }
  };

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    if (clientSecret && walletsAvailable === null && step === 'select') {
      timeout = setTimeout(() => {
        setWalletsAvailable(false);
      }, 5000);
    }
    return () => clearTimeout(timeout);
  }, [clientSecret, walletsAvailable, step]);
  
  const { mutateAsync: createIntent, isPending: isCreatingIntent } = useCreatePaymentIntent();

  useEffect(() => {
    if (!isNativeApp() && isOpen && !clientSecret && !intentError) {
      setWalletsAvailable(null);
      createIntent({ amount: amount as any, paymentMethod: 'credit_card' as any })
        .then((res) => {
          setClientSecret(res.clientSecret);
          setPaymentIntentId(res.paymentIntentId);
        })
        .catch((e: any) => {
          const message = e instanceof Error ? e.message : "Unknown error";
          setIntentError(message);
          toast.error(message);
        });
    }
  }, [isOpen, clientSecret, intentError, amount, createIntent]);

  const handleRetryIntent = () => {
    setIntentError(null);
    setClientSecret('');
    setPaymentIntentId('');
  };

  const handleSelectMethod = async (method: string) => {
    setPaymentMethod(method);
    
    if (method === 'paypal') {
      setStep('paypal');
      return;
    }

    if (method === 'credit_card' && clientSecret) {
      setStep('payment');
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

  const handleNativeWalletClick = async () => {
    try {
      const res = await createHandoff({ amount: amount as any });
      setHandoffToken(res.token);
      window.open(res.url, "_blank");
      setIsWaitingHandoff(true);
    } catch (err: any) {
      toast.error(err.message || t("topup.wallet_app_failed"));
    }
  };

  const handleClose = () => {
    setStep('select');
    setPaymentMethod('');
    setClientSecret('');
    setPaymentIntentId('');
    setWalletsAvailable(null);
    setIntentError(null);
    setHandoffToken(null);
    setIsWaitingHandoff(false);
    onClose();
  };

  const showWalletLoading = !intentError && !clientSecret;
  const showWalletSection = clientSecret && walletsAvailable !== false;
  const showWalletUnavailableHint = clientSecret && walletsAvailable === false;

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
          <>
            {isWaitingHandoff ? (
              <div className={styles.waitingContainer}>
                <h4 className={styles.walletsTitle}>{t("topup.wallet_app_waiting_title")}</h4>
                <p className={styles.walletAppHint}>{t("topup.wallet_app_waiting_text")}</p>
                <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
                  <Button variant="outline" onClick={() => setIsWaitingHandoff(false)}>
                    {t("topup.cancel")}
                  </Button>
                  <Button onClick={checkHandoffStatus} disabled={isCheckingHandoff}>
                    {t("topup.wallet_app_check")}
                  </Button>
                </div>
              </div>
            ) : intentError ? (
              <div className={styles.errorContainer}>
                <p className={styles.errorText}>{intentError}</p>
                <Button variant="outline" onClick={handleRetryIntent}>
                  {t("topup.retry")}
                </Button>
              </div>
            ) : (
              <>
                {isNativeApp() && (
                  <div className={styles.walletSection}>
                    {nativeWalletAvailability === null ? (
                      <>
                        <h4 className={styles.walletsTitle}>{t("topup.wallets_title")}</h4>
                        <div className={styles.walletSkeletonWrapper}>
                          <Skeleton className={styles.walletSkeleton} />
                        </div>
                      </>
                    ) : nativeWalletAvailability.applePay || nativeWalletAvailability.googlePay ? (
                      <>
                        <h4 className={styles.walletsTitle}>{t("topup.wallet_native_title")}</h4>
                        {nativeWalletAvailability.applePay && (
                          <Button 
                            onClick={() => handleNativeWalletPay("apple_pay")} 
                            disabled={isNativeWalletProcessing}
                          >
                            {isNativeWalletProcessing ? t("topup.wallet_native_processing") : t("topup.wallet_native_apple")}
                          </Button>
                        )}
                        {nativeWalletAvailability.googlePay && (
                          <Button 
                            onClick={() => handleNativeWalletPay("google_pay")} 
                            disabled={isNativeWalletProcessing}
                          >
                            {isNativeWalletProcessing ? t("topup.wallet_native_processing") : t("topup.wallet_native_google")}
                          </Button>
                        )}
                      </>
                    ) : (
                      <>
                        <h4 className={styles.walletsTitle}>{t("topup.wallet_app_title")}</h4>
                        <Button onClick={handleNativeWalletClick} disabled={isCreatingHandoff}>
                          {isCreatingHandoff ? t("topup.wallet_app_opening") : t("topup.wallet_app_button")}
                        </Button>
                        <p className={styles.walletAppHint}>{t("topup.wallet_app_hint")}</p>
                      </>
                    )}
                  </div>
                )}
                
                {!isNativeApp() && showWalletLoading && (
                  <div className={styles.walletSection}>
                    <h4 className={styles.walletsTitle}>{t("topup.wallets_title")}</h4>
                    <div className={styles.walletSkeletonWrapper}>
                      <Skeleton className={styles.walletSkeleton} />
                    </div>
                  </div>
                )}

                {!isNativeApp() && showWalletSection && (
                  <div className={styles.walletSection}>
                    <h4 className={styles.walletsTitle}>{t("topup.wallets_title")}</h4>
                    <Elements stripe={stripePromise} options={{ clientSecret }}>
                      <WalletExpressCheckout 
                        amount={amount}
                        paymentIntentId={paymentIntentId}
                        onSuccess={handleClose}
                        onReady={(available) => setWalletsAvailable(available)}
                      />
                    </Elements>
                  </div>
                )}

                {!isNativeApp() && showWalletUnavailableHint && (
                  <div className={styles.walletUnavailableHint}>
                    {t("topup.wallets_unavailable")}
                  </div>
                )}

                {(isNativeApp() || walletsAvailable === true) && (
                  <div className={styles.divider}>
                    <span className={styles.dividerText}>{t("topup.or_other")}</span>
                  </div>
                )}

                <div className={styles.methodGrid}>
                  {PaymentMethods.map(m => (
                    <button 
                      key={m.id} 
                      className={styles.methodCard} 
                      onClick={() => handleSelectMethod(m.id)}
                      disabled={isCreatingIntent}
                      type="button"
                    >
                      <m.icon size={24} className={styles.methodIcon} />
                      <span>{m.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
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
      </DialogContent>
    </Dialog>
  );
};
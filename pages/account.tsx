import React, { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/Tabs';
import { AccountProfile } from '../components/AccountProfile';
import { AccountPoints } from '../components/AccountPoints';
import { AccountBibercode } from '../components/AccountBibercode';
import { AccountDonations } from '../components/AccountDonations';
import { AccountOrders } from '../components/AccountOrders';
import { AccountInvoices } from '../components/AccountInvoices';
import { AccountNotifications } from '../components/AccountNotifications';
import { useProfile } from '../helpers/useCustomerApi';
import { Skeleton } from '../components/Skeleton';
import { useTranslation } from '../helpers/useTranslation';
import { useConfirmTopup } from '../helpers/useStripeTopup';
import { toast } from 'sonner';
import styles from './account.module.css';

export default function Account() {
  const { data: profile, isLoading } = useProfile();
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  const searchParams = new URLSearchParams(location.search);
  const currentTab = searchParams.get('tab') || 'profil';

  const { mutateAsync: confirmTopup } = useConfirmTopup();
  const processedRef = useRef(false);

  useEffect(() => {
    const redirectStatus = searchParams.get('redirect_status');
    const paymentIntentId = searchParams.get('payment_intent');
    const topupAmount = searchParams.get('topup_amount');
    const topupMethod = searchParams.get('topup_method');

    if (!redirectStatus || processedRef.current) return;
    processedRef.current = true;

    const cleanupUrl = () => {
      navigate('/account?tab=guthaben', { replace: true });
    };

    if (redirectStatus === 'succeeded' && paymentIntentId && topupAmount) {
      confirmTopup({
        paymentIntentId,
        amount: Number(topupAmount) as any,
        paymentMethod: (topupMethod || 'klarna') as any,
      })
        .then((res) => {
          toast.success(t('topup.success', { points: res.pointsCredited }));
          cleanupUrl();
        })
        .catch((err) => {
          toast.error(err.message || t('topup.failed'));
          cleanupUrl();
        });
    } else if (redirectStatus !== 'succeeded') {
      toast.error(t('topup.failed'));
      cleanupUrl();
    }
  }, [location.search, confirmTopup, navigate, t]);

  const handleTabChange = (val: string) => {
    navigate(`/account?tab=${val}`, { replace: true });
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <Skeleton className={styles.skeletonHeader} />
        <Skeleton className={styles.skeletonBody} />
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>{t('account.title')}</h1>
      
      <Tabs value={currentTab} onValueChange={handleTabChange} className={styles.tabs}>
        <TabsList className={styles.tabsList}>
          <TabsTrigger value="profil">{t('account.tab.profile')}</TabsTrigger>
          <TabsTrigger value="guthaben">{t('account.tab.guthaben')}</TabsTrigger>
          <TabsTrigger value="bibercode">{t('account.tab.bibercode')}</TabsTrigger>
          <TabsTrigger value="spenden">{t('account.tab.biber_smile')}</TabsTrigger>
          <TabsTrigger value="bestellungen">{t('account.tab.orders')}</TabsTrigger>
          <TabsTrigger value="rechnungen">{t('account.tab.invoices')}</TabsTrigger>
          <TabsTrigger value="benachrichtigungen">{t('account.tab.notifications')}</TabsTrigger>
        </TabsList>
        
        <div className={styles.tabContentContainer}>
          <TabsContent value="profil"><AccountProfile profile={profile} /></TabsContent>
          <TabsContent value="guthaben"><AccountPoints profile={profile} /></TabsContent>
          <TabsContent value="bibercode"><AccountBibercode profile={profile} /></TabsContent>
          <TabsContent value="spenden"><AccountDonations profile={profile} /></TabsContent>
          <TabsContent value="bestellungen"><AccountOrders /></TabsContent>
          <TabsContent value="rechnungen"><AccountInvoices /></TabsContent>
          <TabsContent value="benachrichtigungen"><AccountNotifications profile={profile} /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
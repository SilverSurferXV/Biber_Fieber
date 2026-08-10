import React, { useState } from 'react';
import { Button } from './Button';
import { Input } from './Input';
import { useCustomerReferrals } from '../helpers/useCustomerReferrals';
import { useApplyBibercodeMutation } from '../helpers/useApplyBibercodeMutation';
import { toast } from 'sonner';
import { Copy, Share2, CheckCircle, Info } from 'lucide-react';
import { useTranslation } from '../helpers/useTranslation';
import styles from './AccountBibercode.module.css';

export const AccountBibercode = ({ profile }: { profile: any }) => {
  const { t } = useTranslation();
  const { data: referralsData, isLoading: isLoadingReferrals } = useCustomerReferrals();
  const [inputCode, setInputCode] = useState("");
  const { mutate: applyBibercode, isPending: isApplying } = useApplyBibercodeMutation();

  const copyCode = () => {
    navigator.clipboard.writeText(profile.bibercode || '');
    toast.success(t("bibercode.copied_code"));
  };

  const copyLink = () => {
    const url = `${window.location.origin}/login`;
    navigator.clipboard.writeText(url);
    toast.success(t("bibercode.copied_link"));
  };

  const handleApplyCode = () => {
    if (!inputCode.trim()) return;
    applyBibercode({ code: inputCode }, {
      onSuccess: (data) => {
        toast.success(t("bibercode.success", { name: data.ownerName }));
        setInputCode("");
      },
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : t("bibercode.apply_error"));
      }
    });
  };

  const shareCode = async () => {
    const url = `${window.location.origin}/login`;
    const text = `Nutze meinen Bibercode: ${profile.bibercode}. Hier registrieren: ${url}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: t("bibercode.title"),
          text: text,
        });
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          copyLink();
        }
      }
    } else {
      copyLink();
    }
  };

  return (
    <div className={styles.viewContainer}>
      <div className={styles.bibercodeBox}>
        <div className={styles.biberVisual}>
          <img src="https://assets.floot.app/369c3501-fab4-4d1f-9c4f-7e589a5b18c1/594434e3-28e9-45cc-a84b-92e065ccf601.png" alt="Mascot" className={styles.biberImg} />
        </div>
        <div className={styles.biberContent}>
          <h3>{t("bibercode.title")}</h3>
          <p>{t("bibercode.share")}</p>
          
          <div className={styles.codeRow}>
            <div className={styles.codeDisplay}>{profile.bibercode}</div>
            <Button onClick={copyCode} variant="outline" size="icon" title="Kopieren"><Copy size={18} /></Button>
            <Button onClick={shareCode} variant="outline" size="icon" title="Teilen"><Share2 size={18} /></Button>
          </div>

          <div className={styles.linkRow}>
            <p>{t("bibercode.register_here")}</p>
            <div className={styles.urlBox}>
              <span>{window.location.origin}/login</span>
              <Button onClick={copyLink} variant="ghost" size="sm">{t("bibercode.copy_link")}</Button>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.applyCodeBox}>
        <div className={styles.applyCodeContent}>
          <h3>{t("bibercode.add_code")}</h3>
          {profile.referredByBibercode ? (
            <div className={styles.successMessage}>
              <CheckCircle size={20} className={styles.successIcon} />
              <span>{t("bibercode.already_added", { code: profile.referredByBibercode })}</span>
            </div>
          ) : profile.charityOrganizationId ? (
            <div className={styles.infoBanner}>
              <Info size={20} className={styles.infoIcon} />
              <p className={styles.infoText}>
                {t("bibercode.smile_active")}
              </p>
            </div>
          ) : (
            <>
              <p>{t("bibercode.description")}</p>
              <div className={styles.applyRow}>
                <Input 
                  value={inputCode} 
                  onChange={(e) => setInputCode(e.target.value)} 
                  placeholder={t("bibercode.placeholder")} 
                  disabled={isApplying}
                />
                <Button onClick={handleApplyCode} disabled={isApplying || !inputCode.trim()}>
                  {isApplying ? t("bibercode.checking") : t("bibercode.submit_code")}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className={styles.friendsSection}>
        <h3 className={styles.friendsTitle}>{t("bibercode.friends")} {t("bibercode.max_friends")}</h3>
        {isLoadingReferrals ? (
          <p>{t("bibercode.loading_friends")}</p>
        ) : !referralsData?.referrals || referralsData.referrals.length === 0 ? (
          <p className={styles.emptyState}>{t("bibercode.no_friends")}</p>
        ) : (
          <div className={styles.friendsList}>
            {referralsData.referrals.map((friend) => (
              <div key={friend.id} className={styles.friendCard}>
                <div className={styles.friendInfo}>
                  <div className={styles.friendName}>
                    {friend.firstName} {friend.lastName}
                  </div>
                  <div className={styles.friendAddress}>
                    {friend.streetAddress}, {friend.postcode} {friend.city}
                  </div>
                  <div className={styles.friendDate}>
                    {t("bibercode.friend_since", { date: new Date(friend.createdAt!).toLocaleDateString("de-DE") })}
                  </div>
                </div>
                <div className={styles.friendPoints}>
                  <span className={styles.friendPointsValue}>{Number(friend.totalPointsEarned || 0).toFixed(2)}</span>
                  <span className={styles.friendPointsLabel}>{t("bibercode.points_earned")}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
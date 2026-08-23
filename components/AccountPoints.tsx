import React, { useState } from 'react';
import { Button } from './Button';
import { Badge } from './Badge';
import { TopupPaymentDialog } from './TopupPaymentDialog';
import { useTranslation } from '../helpers/useTranslation';
import { useCustomerPointHistory } from '../helpers/useCustomerPointHistory';
import { profileCompleteness } from '../helpers/profileCompleteness';
import { CompleteProfileDialog } from './CompleteProfileDialog';
import { Skeleton } from './Skeleton';
import styles from './AccountPoints.module.css';

export const AccountPoints = ({ profile }: { profile: any }) => {
  const { t } = useTranslation();
  const [selectedTopup, setSelectedTopup] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [pendingTopupAmount, setPendingTopupAmount] = useState<number | null>(null);
  const [showCompleteProfile, setShowCompleteProfile] = useState(false);
  const { data: historyData, isLoading: isHistoryLoading } = useCustomerPointHistory();

  const renderBadge = (type: string, amount: number) => {
    if (type === "topup") return <Badge variant="success">{t("points.topup_badge")}</Badge>;
    if (type === "order_payment") return amount < 0 ? <Badge variant="destructive">{t("points.order_badge")}</Badge> : <Badge variant="warning">{t("points.refund_badge")}</Badge>;
    if (type === "bibercode_credit") return <Badge variant="primary">{t("points.bibercode_bonus")}</Badge>;
    if (type === "admin_adjustment") return <Badge variant="outline">{t("points.adjustment")}</Badge>;
    return <Badge variant="secondary">{type}</Badge>;
  };

  const handleTopupClick = (amount: number) => {
    const completeness = profileCompleteness(profile);
    if (completeness.isComplete) {
      setSelectedTopup(amount);
    } else {
      setPendingTopupAmount(amount);
      setShowCompleteProfile(true);
    }
  };

  const options = [
    { amount: 15, bonus: 0 },
    { amount: 25, bonus: 5 },
    { amount: 50, bonus: 7 },
    { amount: 100, bonus: 10 },
    { amount: 200, bonus: 10.5 },
    { amount: 500, bonus: 11 },
  ];

  return (
    <div className={styles.viewContainer}>
      <div className={`${styles.balanceBox} ${styles.balanceBoxClickable}`} onClick={() => setShowHistory(!showHistory)}>
        <h3>{t("points.current")}</h3>
        <div className={styles.pointsHuge}>{Number(profile.pointsBalance || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        <p>{t("points.rate")}</p>
        <p className={styles.hintText}>{t("points.history_hint") === "points.history_hint" ? t("points.tap_for_history") : t("points.history_hint")}</p>
      </div>

      {showHistory && (
        <div className={styles.historySection}>
          <div className={styles.historyHeader}>
            <h4>{t("points.history")}</h4>
            <button className={styles.closeButton} onClick={(e) => { e.stopPropagation(); setShowHistory(false); }}>{t("points.close")}</button>
          </div>
          <div className={styles.historyList}>
            {isHistoryLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className={styles.historyCard}>
                  <Skeleton className={styles.skeletonRow} />
                  <Skeleton className={styles.skeletonRowShort} />
                </div>
              ))
            ) : historyData?.transactions?.length ? (
              historyData.transactions.map((txn: any) => {
                const amount = Number(txn.amount);
                const isPositive = amount > 0;
                return (
                  <div key={txn.id} className={styles.historyCard}>
                    <div className={styles.historyCardHeader}>
                      {renderBadge(txn.type, amount)}
                      <span className={`${styles.historyAmount} ${isPositive ? styles.amountPositive : styles.amountNegative}`}>
                        {isPositive ? "+" : ""}{amount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                      </span>
                    </div>
                    {txn.note && <p className={styles.historyNote}>{txn.note}</p>}
                    <span className={styles.historyDate}>
                      {new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(txn.createdAt))}
                    </span>
                  </div>
                );
              })
            ) : (
              <p className={styles.emptyHistory}>{t("points.no_transactions")}</p>
            )}
          </div>
        </div>
      )}

      <div className={styles.topupHeader}>
        <h4>{t("points.topup")}</h4>
        {!profileCompleteness(profile).isComplete && (
          <p className={styles.incompleteProfileHint}>
            {t("complete_profile.required_hint")}
          </p>
        )}
      </div>
      <div className={styles.topupGrid}>
        {options.map(opt => (
          <div key={opt.amount} className={styles.topupCard}>
            <div className={styles.topupAmount}>{opt.amount} €</div>
            {opt.bonus > 0 ? (
              <Badge variant="success" className={styles.bonusBadge}>{t("points.bonus", { bonus: opt.bonus })}</Badge>
            ) : (
              <div className={styles.noBonus}>{t("points.no_bonus")}</div>
            )}
            <p className={styles.receiveText}>{t("points.receive", { amount: (opt.amount * (1 + opt.bonus / 100)).toFixed(2) })}</p>
            <Button onClick={() => handleTopupClick(opt.amount)} className={styles.topupAction}>{t("points.buy")}</Button>
          </div>
        ))}
      </div>

      {selectedTopup !== null && (
        <TopupPaymentDialog
          isOpen={true}
          onClose={() => setSelectedTopup(null)}
          amount={selectedTopup}
        />
      )}

      {showCompleteProfile && (
        <CompleteProfileDialog
          isOpen={true}
          onClose={() => {
            setShowCompleteProfile(false);
            setPendingTopupAmount(null);
          }}
          profile={profile}
          onCompleted={() => {
            setShowCompleteProfile(false);
            if (pendingTopupAmount !== null) {
              setSelectedTopup(pendingTopupAmount);
              setPendingTopupAmount(null);
            }
          }}
        />
      )}
    </div>
  );
};
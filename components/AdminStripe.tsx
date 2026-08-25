import React, { useEffect, useState } from 'react';
import { CreditCard, AlertCircle, CheckCircle, Plus, X, Save, AlertTriangle } from 'lucide-react';
import { useStripeStatus, useStripeTopups } from '../helpers/useStripeAdmin';
import { useSettings } from '../helpers/useShopApi';
import { useSaveBonusTiersMutation } from '../helpers/useSaveBonusTiersMutation';
import { STRIPE_PUBLISHABLE_KEY } from '../helpers/_publicConfigs';
import { Badge } from './Badge';
import { Skeleton } from './Skeleton';
import { Input } from './Input';
import { Button } from './Button';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import styles from './AdminStripe.module.css';

const dateFormatter = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const currencyFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
});

const percentFormatter = new Intl.NumberFormat('de-DE', {
  style: 'percent',
  maximumFractionDigits: 0,
});

const PAYMENT_METHODS = [
  'Kreditkarte',
  'Klarna',
  'Sofortüberweisung',
  'PayPal',
];

export const AdminStripe = () => {
  const queryClient = useQueryClient();
  const { data: statusData, isLoading: isLoadingStatus } = useStripeStatus();
  const { data: topupsData, isLoading: isLoadingTopups } = useStripeTopups();
  const { data: settingsData, isLoading: isLoadingSettings } = useSettings();
  const { mutateAsync: saveTiers, isPending: isSavingTiers } = useSaveBonusTiersMutation();

  const [editedTiers, setEditedTiers] = useState<{ amount: number; bonusPercent: number }[]>([]);

  useEffect(() => {
    if (settingsData?.bonusTiers && Array.isArray(settingsData.bonusTiers)) {
      const tiers = [...(settingsData.bonusTiers as any[])].sort((a, b) => a.amount - b.amount);
      setEditedTiers(tiers);
    } else if (settingsData && !settingsData.bonusTiers) {
      setEditedTiers([]);
    }
  }, [settingsData]);

  const handleAddTier = () => {
    setEditedTiers([...editedTiers, { amount: 0, bonusPercent: 0 }]);
  };

  const handleRemoveTier = (index: number) => {
    const newTiers = [...editedTiers];
    newTiers.splice(index, 1);
    setEditedTiers(newTiers);
  };

  const handleTierChange = (index: number, field: 'amount' | 'bonusPercent', value: string) => {
    const newTiers = [...editedTiers];
    newTiers[index][field] = parseFloat(value) || 0;
    setEditedTiers(newTiers);
  };

  const handleSaveTiers = async () => {
    try {
      const sortedTiers = [...editedTiers].sort((a, b) => a.amount - b.amount);
      await saveTiers({ tiers: sortedTiers });
      toast.success('Bonus-Stufen erfolgreich gespeichert');
      queryClient.invalidateQueries({ queryKey: ["shop", "settings"] });
    } catch (error: any) {
      toast.error(error.message || 'Fehler beim Speichern der Bonus-Stufen');
    }
  };

  const maskedKey = STRIPE_PUBLISHABLE_KEY 
    ? `••••••••••••••••${STRIPE_PUBLISHABLE_KEY.slice(-4)}`
    : 'Nicht konfiguriert';
    
  const isFrontendTestMode = STRIPE_PUBLISHABLE_KEY.startsWith('pk_test_');
  const modeMismatch = statusData?.connected && typeof statusData.livemode === 'boolean' && 
    statusData.livemode !== !isFrontendTestMode;

  return (
    <div className={styles.viewContainer}>
      <div className={styles.header}>
        <h2>Stripe Integration</h2>
      </div>
      
      {modeMismatch && (
        <div className={styles.modeMismatchWarning}>
          <AlertTriangle size={20} style={{ marginRight: 'var(--spacing-2)', flexShrink: 0 }} />
          <div>
            <strong>Warnung: Modi-Konflikt</strong><br />
            Der Frontend-Publishable-Key läuft im {isFrontendTestMode ? 'Testmodus' : 'Live-Modus'}, während das Backend im {statusData?.livemode ? 'Live-Modus' : 'Testmodus'} läuft. In diesem Zustand können Zahlungen fehlschlagen.
          </div>
        </div>
      )}

      <div className={styles.gridContainer}>
        {/* Connection Status */}
        <div className={styles.sectionBox}>
          <h3>Verbindungsstatus</h3>
          {isLoadingStatus ? (
            <div className={styles.skeletonGroup}>
              <Skeleton style={{ height: '2rem', width: '150px' }} />
              <Skeleton style={{ height: '1rem', width: '200px' }} />
            </div>
          ) : (
            <div className={styles.statusContent}>
              <div className={styles.statusRow}>
                <span className={styles.statusLabel}>Status:</span>
                {statusData?.connected ? (
                  <Badge variant="success">
                    <CheckCircle size={14} style={{ marginRight: 'var(--spacing-1)' }} />
                    Verbunden
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    <AlertCircle size={14} style={{ marginRight: 'var(--spacing-1)' }} />
                    Fehler
                  </Badge>
                )}
              </div>
              
              {statusData?.connected && typeof statusData.livemode === 'boolean' && (
                <div className={styles.statusRow}>
                  <span className={styles.statusLabel}>Modus:</span>
                  <Badge variant={statusData.livemode ? "success" : "warning"}>
                    {statusData.livemode ? "Live-Modus" : "Testmodus"}
                  </Badge>
                </div>
              )}
              
              {!statusData?.connected && 'error' in (statusData || {}) && (
                <div className={styles.errorMessage}>
                  {(statusData as any).error}
                </div>
              )}

              <div className={styles.statusRow}>
                <span className={styles.statusLabel}>Publishable Key:</span>
                <code className={styles.maskedKey}>{maskedKey}</code>
              </div>
            </div>
          )}
        </div>

        {/* Payment Methods */}
        <div className={styles.sectionBox}>
          <h3>Verfügbare Zahlungsmethoden</h3>
          <div className={styles.badgeContainer}>
            {PAYMENT_METHODS.map((method) => (
              <Badge key={method} variant="outline" className={styles.methodBadge}>
                <CreditCard size={14} style={{ marginRight: 'var(--spacing-1)' }} />
                {method}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {/* Bonus Tiers */}
      <div className={styles.sectionBox}>
        <h3>Bonus-Stufen</h3>
        {isLoadingSettings ? (
          <div className={styles.skeletonGroup}>
            <Skeleton style={{ height: '2rem', width: '100%' }} />
            <Skeleton style={{ height: '2rem', width: '100%' }} />
          </div>
        ) : (
          <>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Betrag (€)</th>
                    <th>Bonus (%)</th>
                    <th>Punkte gesamt</th>
                    <th style={{ width: '40px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {editedTiers.map((tier, index) => {
                    const bonusAmount = tier.amount * (tier.bonusPercent / 100);
                    const totalPoints = tier.amount + bonusAmount;
                    return (
                      <tr key={index}>
                        <td>
                          <Input
                            type="number"
                            step="1"
                            value={tier.amount || ''}
                            onChange={(e) => handleTierChange(index, 'amount', e.target.value)}
                            className={styles.compactInput}
                          />
                        </td>
                        <td>
                          <Input
                            type="number"
                            step="1"
                            value={tier.bonusPercent || ''}
                            onChange={(e) => handleTierChange(index, 'bonusPercent', e.target.value)}
                            className={styles.compactInput}
                          />
                        </td>
                        <td className={styles.highlightVal}>{totalPoints.toFixed(2)}</td>
                        <td>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleRemoveTier(index)}
                            className={styles.deleteBtn}
                          >
                            <X size={16} />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {editedTiers.length === 0 && (
                    <tr>
                      <td colSpan={4} className={styles.emptyState}>
                        Keine Bonus-Stufen konfiguriert.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className={styles.actionsRow}>
              <Button variant="outline" onClick={handleAddTier}>
                <Plus size={16} style={{ marginRight: 'var(--spacing-1)' }} />
                Zeile hinzufügen
              </Button>
              <Button variant="primary" onClick={handleSaveTiers} disabled={isSavingTiers}>
                {isSavingTiers ? <Skeleton style={{ width: 16, height: 16, borderRadius: '50%' }} /> : <Save size={16} style={{ marginRight: 'var(--spacing-1)' }} />}
                Speichern
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Recent Top-ups */}
      <div className={styles.sectionBox}>
        <h3>Letzte Aufladungen</h3>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Datum</th>
                <th>Kunde</th>
                <th>E-Mail</th>
                <th>Zahlungsart</th>
                <th>Betrag</th>
                <th>Bonus %</th>
                <th>Punkte</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingTopups ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td><Skeleton /></td>
                    <td><Skeleton /></td>
                    <td><Skeleton /></td>
                    <td><Skeleton /></td>
                    <td><Skeleton /></td>
                    <td><Skeleton /></td>
                    <td><Skeleton /></td>
                  </tr>
                ))
              ) : topupsData && topupsData.length > 0 ? (
                topupsData.map((topup) => (
                  <tr key={topup.id}>
                    <td>{topup.topupDate ? dateFormatter.format(new Date(topup.topupDate)) : '-'}</td>
                    <td>{[topup.firstName, topup.lastName].filter(Boolean).join(' ') || '-'}</td>
                    <td>{topup.email || '-'}</td>
                    <td className={styles.capitalize}>{topup.paymentMethod?.replace('_', ' ') || '-'}</td>
                    <td>{currencyFormatter.format(topup.amount)}</td>
                    <td>{topup.bonusPercent != null ? percentFormatter.format(topup.bonusPercent / 100) : '-'}</td>
                    <td className={styles.highlightVal}>{topup.pointsCredited}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className={styles.emptyState}>
                    Keine Aufladungen gefunden.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
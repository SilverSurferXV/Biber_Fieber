import React from 'react';
import { CreditCard, AlertCircle, CheckCircle } from 'lucide-react';
import { usePaypalStatus } from '../helpers/usePaypalAdmin';
import { Badge } from './Badge';
import { Skeleton } from './Skeleton';
import styles from './AdminPaypal.module.css';

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

export const AdminPaypal = () => {
  const { data, isLoading, isError, error } = usePaypalStatus();

  return (
    <div className={styles.viewContainer}>
      <div className={styles.header}>
        <h2>PayPal Integration</h2>
      </div>

      <div className={styles.gridContainer}>
        {/* Connection Status */}
        <div className={styles.sectionBox}>
          <h3>Verbindungsstatus</h3>
          {isLoading ? (
            <div className={styles.skeletonGroup}>
              <Skeleton style={{ height: '2rem', width: '150px' }} />
              <Skeleton style={{ height: '1rem', width: '200px' }} />
            </div>
          ) : isError ? (
            <div className={styles.errorMessage}>
              Fehler beim Laden: {error?.message}
            </div>
          ) : (
            <div className={styles.statusContent}>
              <div className={styles.statusRow}>
                <span className={styles.statusLabel}>Status:</span>
                {data?.connected ? (
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
              
              {!data?.connected && data?.error && (
                <div className={styles.errorMessage}>
                  {data.error}
                </div>
              )}

              <div className={styles.statusRow}>
                <span className={styles.statusLabel}>Client ID:</span>
                <code className={styles.maskedKey}>{data?.clientId || 'Nicht konfiguriert'}</code>
              </div>
            </div>
          )}
        </div>

        {/* Configuration */}
        <div className={styles.sectionBox}>
          <h3>Konfiguration</h3>
          <div className={styles.statusContent}>
            <div className={styles.statusRow}>
              <span className={styles.statusLabel}>Modus:</span>
              <Badge variant="outline" className={styles.methodBadge}>
                {data?.mode || 'Unbekannt'}
              </Badge>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)', marginTop: 'var(--spacing-2)' }}>
              Die PayPal-Integration erlaubt die Abwicklung von Zahlungen via PayPal Checkout. Alle Zahlungen werden als sichere Transaktionen über das PayPal-Konto oder mit den von PayPal angebotenen Gästemethoden abgewickelt.
            </p>
          </div>
        </div>
      </div>

      {/* Recent Top-ups */}
      <div className={styles.sectionBox}>
        <h3>Letzte PayPal-Aufladungen</h3>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Datum</th>
                <th>Kunde</th>
                <th>E-Mail</th>
                <th>Betrag</th>
                <th>Bonus %</th>
                <th>Punkte</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td><Skeleton /></td>
                    <td><Skeleton /></td>
                    <td><Skeleton /></td>
                    <td><Skeleton /></td>
                    <td><Skeleton /></td>
                    <td><Skeleton /></td>
                  </tr>
                ))
              ) : data?.recentTopups && data.recentTopups.length > 0 ? (
                data.recentTopups.map((topup) => (
                  <tr key={topup.id}>
                    <td>{topup.topupDate ? dateFormatter.format(topup.topupDate) : '-'}</td>
                    <td>{[topup.firstName, topup.lastName].filter(Boolean).join(' ') || '-'}</td>
                    <td>{topup.email || '-'}</td>
                    <td>{currencyFormatter.format(topup.amount)}</td>
                    <td>{topup.bonusPercent != null ? percentFormatter.format(topup.bonusPercent / 100) : '-'}</td>
                    <td className={styles.highlightVal}>{topup.pointsCredited}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className={styles.emptyState}>
                    Keine PayPal-Aufladungen gefunden.
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
import React from 'react';
import { Mail, AlertCircle, CheckCircle } from 'lucide-react';
import { useMailjetStatus } from '../helpers/useMailjetAdmin';
import { Badge } from './Badge';
import { Skeleton } from './Skeleton';
import styles from './AdminMailjet.module.css';

const dateFormatter = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export const AdminMailjet = () => {
  const { data, isLoading, isError, error } = useMailjetStatus();

  return (
    <div className={styles.viewContainer}>
      <div className={styles.header}>
        <h2>Mailjet Integration</h2>
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
                <span className={styles.statusLabel}>API Key:</span>
                <code className={styles.maskedKey}>{data?.maskedApiKey || 'Nicht konfiguriert'}</code>
              </div>
            </div>
          )}
        </div>

        {/* Sender Addresses */}
        <div className={styles.sectionBox}>
          <h3>Absender-Adressen</h3>
          <div className={styles.badgeContainer}>
            {isLoading ? (
              <div className={styles.skeletonGroup}>
                <Skeleton style={{ height: '2rem', width: '100%' }} />
              </div>
            ) : data?.senders && data.senders.length > 0 ? (
              data.senders.map((sender, idx) => (
                <div key={idx} className={styles.senderRow}>
                  <Mail size={16} className={styles.senderIcon} />
                  <span className={styles.senderEmail}>{sender.email}</span>
                  <Badge 
                    variant={sender.status.toLowerCase() === 'active' ? 'success' : 'outline'} 
                    className={styles.methodBadge}
                  >
                    {sender.status}
                  </Badge>
                </div>
              ))
            ) : (
              <div className={styles.emptyState}>Keine Absender gefunden.</div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Messages */}
      <div className={styles.sectionBox}>
        <h3>Letzte Nachrichten</h3>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Datum</th>
                <th>Empfänger</th>
                <th>Absender</th>
                <th>Betreff</th>
                <th>Status</th>
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
                  </tr>
                ))
              ) : data?.recentMessages && data.recentMessages.length > 0 ? (
                data.recentMessages.map((msg) => (
                  <tr key={msg.id}>
                    <td>{msg.sentAt ? dateFormatter.format(new Date(msg.sentAt)) : '-'}</td>
                    <td>{msg.to}</td>
                    <td>{msg.from}</td>
                    <td>{msg.subject}</td>
                    <td>
                      <Badge variant={msg.status === 'sent' ? 'success' : 'outline'}>
                        {msg.status}
                      </Badge>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className={styles.emptyState}>
                    Keine Nachrichten gefunden.
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
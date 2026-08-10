import React, { useMemo } from 'react';
import { FileText } from 'lucide-react';
import { useAdminOrders } from '../helpers/useAdminApi';
import { Skeleton } from './Skeleton';
import { Button } from './Button';
import { generateZBerichtPdf } from '../helpers/generateZBerichtPdf';
import adminStyles from './AdminViews.module.css';
import styles from './AdminDailyClosing.module.css';

const dateFormatter = new Intl.DateTimeFormat('de-DE', { 
  weekday: 'long', 
  day: '2-digit', 
  month: '2-digit', 
  year: 'numeric' 
});

const currencyFormatter = new Intl.NumberFormat('de-DE', { 
  style: 'currency', 
  currency: 'EUR' 
});

const percentageFormatter = new Intl.NumberFormat('de-DE', {
  style: 'percent',
  maximumFractionDigits: 2
});

type TaxSummary = {
  netto: number;
  tax: number;
};

type DailySummary = {
  date: Date;
  dateStr: string;
  brutto: number;
  netto: number;
  uniqueCustomers: Set<number>;
  orderCount: number;
  wareneinsatz: number;
  db1: number;
  taxes: Record<string, TaxSummary>;
  paymentMethods: Record<string, number>;
};

export const AdminDailyClosing = () => {
  const { data, isLoading } = useAdminOrders({ limit: 10000 });

  const groupedDays = useMemo(() => {
    if (!data?.orders) return [];

    const groups: Record<string, DailySummary> = {};

    for (const order of data.orders) {
      if (!order.createdAt) continue;
      
      const d = new Date(order.createdAt);
      // Group by YYYY-MM-DD
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      if (!groups[dateKey]) {
        groups[dateKey] = {
          date: d,
          dateStr: dateKey,
          brutto: 0,
          netto: 0,
          uniqueCustomers: new Set<number>(),
          orderCount: 0,
          wareneinsatz: 0,
          db1: 0,
          taxes: {},
          paymentMethods: {}
        };
      }

      const g = groups[dateKey];
      const orderTotal = Number(order.total || 0);
      g.brutto += orderTotal;
      g.orderCount += 1;
      
      if (order.customerId) {
        g.uniqueCustomers.add(order.customerId);
      }

      if (order.db1 != null) {
        g.db1 += Number(order.db1);
      }

      const paymentMethod = order.paymentMethod || "Unbekannt";
      g.paymentMethods[paymentMethod] = (g.paymentMethods[paymentMethod] || 0) + orderTotal;

      let orderNetto = 0;

      // Tax breakdowns and orderNetto
      if (order.items && Array.isArray(order.items)) {
        for (const item of order.items) {
          const taxRate = Number(item.taxRate || 0);
          const quantity = Number(item.quantity || 0);
          const unitPrice = Number(item.unitPrice || 0);
          
          const itemNetto = unitPrice * quantity;
          const itemTax = itemNetto * (taxRate / 100);

          orderNetto += itemNetto;

          const taxKey = taxRate.toString();
          if (!g.taxes[taxKey]) {
            g.taxes[taxKey] = { netto: 0, tax: 0 };
          }
          
          g.taxes[taxKey].netto += itemNetto;
          g.taxes[taxKey].tax += itemTax;
        }
      }

      g.netto += orderNetto;

      // Wareneinsatz abs = wareneinsatz ratio * orderNetto
      if (order.wareneinsatz != null) {
        g.wareneinsatz += Number(order.wareneinsatz) * orderNetto;
      }
    }

    return Object.values(groups).sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [data?.orders]);

  if (isLoading) {
    return (
      <div className={adminStyles.viewContainer}>
        <div className={adminStyles.header}>
          <h2>Umsatz Tagesabschluss</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-6)' }}>
          <Skeleton style={{ height: '250px' }} />
          <Skeleton style={{ height: '250px' }} />
          <Skeleton style={{ height: '250px' }} />
        </div>
      </div>
    );
  }

  if (groupedDays.length === 0) {
    return (
      <div className={adminStyles.viewContainer}>
        <div className={adminStyles.header}>
          <h2>Umsatz Tagesabschluss</h2>
        </div>
        <div className={adminStyles.sectionBox}>
          <p>Keine Bestellungen für den Tagesabschluss gefunden.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={adminStyles.viewContainer}>
      <div className={adminStyles.header}>
        <h2>Umsatz Tagesabschluss</h2>
      </div>

      <div className={styles.closingList}>
        {groupedDays.map((day) => {
          const avgOrderValue = day.orderCount > 0 ? day.brutto / day.orderCount : 0;

          return (
            <div key={day.dateStr} className={adminStyles.sectionBox}>
              <div className={styles.dayHeader}>
                <h3 className={styles.dayTitle}>{dateFormatter.format(day.date)}</h3>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => generateZBerichtPdf({
                    date: day.date,
                    dateStr: day.dateStr,
                    brutto: day.brutto,
                    netto: day.netto,
                    orderCount: day.orderCount,
                    uniqueCustomerCount: day.uniqueCustomers.size,
                    wareneinsatz: day.wareneinsatz,
                    db1: day.db1,
                    taxes: day.taxes,
                    paymentMethods: day.paymentMethods,
                  })}
                >
                  <FileText size={16} />
                  Z-Bericht
                </Button>
              </div>
              
              <div className={styles.statsGrid}>
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>Umsatz Brutto</span>
                  <span className={styles.statValue}>{currencyFormatter.format(day.brutto)}</span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>Umsatz Netto</span>
                  <span className={styles.statValue}>{currencyFormatter.format(day.netto)}</span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>Anzahl Kunden</span>
                  <span className={styles.statValue}>{day.uniqueCustomers.size}</span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>Ø Bestellwert (Brutto)</span>
                  <span className={styles.statValue}>{currencyFormatter.format(avgOrderValue)}</span>
                </div>
                                <div className={styles.statItem}>
                  <span className={styles.statLabel}>Wareneinsatz</span>
                  <span className={styles.statValue}>{currencyFormatter.format(day.wareneinsatz)}</span>
                  <span className={styles.statPercent}>
                    {day.netto > 0 ? `${((day.wareneinsatz / day.netto) * 100).toFixed(2).replace('.', ',')}%` : '0,00%'} vom Nettoumsatz
                  </span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>DB1</span>
                  <span className={styles.statValue}>{currencyFormatter.format(day.db1)}</span>
                </div>
              </div>

              {Object.keys(day.taxes).length > 0 && (
                <div className={styles.taxSection}>
                  <h4 className={styles.taxTitle}>Steuersätze</h4>
                  <div className={adminStyles.tableWrapper}>
                    <table className={adminStyles.table}>
                      <thead>
                        <tr>
                          <th>Steuersatz</th>
                          <th style={{ textAlign: 'right' }}>Netto</th>
                          <th style={{ textAlign: 'right' }}>Steuerbetrag</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(day.taxes)
                          .sort(([rateA], [rateB]) => Number(rateB) - Number(rateA))
                          .map(([rate, amounts]) => (
                            <tr key={rate}>
                              <td>{percentageFormatter.format(Number(rate) / 100)}</td>
                              <td style={{ textAlign: 'right' }}>{currencyFormatter.format(amounts.netto)}</td>
                              <td style={{ textAlign: 'right' }}>{currencyFormatter.format(amounts.tax)}</td>
                            </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
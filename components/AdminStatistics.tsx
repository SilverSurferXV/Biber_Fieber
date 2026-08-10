import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useAdminStatistics } from '../helpers/useAdminApi';
import { Skeleton } from './Skeleton';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from './Collapsible';
import styles from './AdminStatistics.module.css';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export const AdminStatistics = () => {
  const { data, isLoading, isError } = useAdminStatistics();
  const [weeklyOrdersOpen, setWeeklyOrdersOpen] = useState(false);

  const groupedCustomers = useMemo(() => {
    if (!data?.weeklyOrdersPerCustomer) return [];

    const groups = new Map<
      string,
      { label: string; customers: typeof data.weeklyOrdersPerCustomer }
    >();

    data.weeklyOrdersPerCustomer.forEach((c) => {
      const hasZone = c.postcode && c.cityName;
      const key = hasZone ? `${c.postcode} ${c.cityName}` : 'Ohne Lieferzone';

      if (!groups.has(key)) {
        groups.set(key, { label: key, customers: [] });
      }
      groups.get(key)!.customers.push(c);
    });

    return Array.from(groups.values()).sort((a, b) =>
      a.label.localeCompare(b.label)
    );
  }, [data?.weeklyOrdersPerCustomer]);

  if (isLoading) {
    return (
      <div className={styles.viewContainer}>
        <div className={styles.header}>
          <h2>Statistiken</h2>
        </div>
        <div className={styles.statsGrid}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} style={{ height: '90px' }} />
          ))}
        </div>
        <div className={styles.statsGrid}>
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} style={{ height: '90px' }} />
          ))}
        </div>
        <Skeleton style={{ height: '300px' }} />
        <Skeleton style={{ height: '300px' }} />
        <Skeleton style={{ height: '300px' }} />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className={styles.viewContainer}>
        <p>Fehler beim Laden der Statistiken.</p>
      </div>
    );
  }

  return (
    <div className={styles.viewContainer}>
      <div className={styles.header}>
        <h2>Statistiken</h2>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Besucher Heute</div>
          <div className={styles.statValue}>{data.visitorsToday}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Besucher diese Woche</div>
          <div className={styles.statValue}>{data.visitorsThisWeek}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Besucher diesen Monat</div>
          <div className={styles.statValue}>{data.visitorsThisMonth}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Besucher Gesamt</div>
          <div className={styles.statValue}>{data.totalVisitors}</div>
        </div>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Ø Verweildauer im Shop</div>
          <div className={styles.statValue}>{formatDuration(data.avgShopDuration)}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Ø Verweildauer auf der Plattform</div>
          <div className={styles.statValue}>{formatDuration(data.avgPlatformDuration)}</div>
        </div>
      </div>

      <div className={styles.sectionBox}>
        <h3>Umsatz-Rangliste nach Lieferzone</h3>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>#Rang</th>
                <th>PLZ</th>
                <th>Name</th>
                <th>Bestellungen</th>
                <th>Gesamtumsatz</th>
                <th>Ø Umsatz pro Bestellung</th>
              </tr>
            </thead>
            <tbody>
              {data.deliveryZoneRanking.map(zone => (
                <tr key={zone.postcode}>
                  <td>{zone.rank}</td>
                  <td>{zone.postcode}</td>
                  <td>{zone.cityName}</td>
                  <td>{zone.orderCount}</td>
                  <td>{zone.totalRevenue.toFixed(2)} €</td>
                  <td>{zone.avgRevenue.toFixed(2)} €</td>
                </tr>
              ))}
              {data.deliveryZoneRanking.length === 0 && (
                <tr>
                  <td colSpan={6}>Keine Daten verfügbar</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Collapsible open={weeklyOrdersOpen} onOpenChange={setWeeklyOrdersOpen}>
        <div className={styles.sectionBox}>
          <CollapsibleTrigger asChild>
            <h3 className={styles.collapsibleHeading}>
              <span>Wöchentliche Bestellungen pro Kunde</span>
              {weeklyOrdersOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            </h3>
          </CollapsibleTrigger>
          <CollapsibleContent>
            {groupedCustomers.length === 0 ? (
              <p>Keine Daten verfügbar</p>
            ) : (
              <div className={styles.tableWrapper}>
                <table className={`${styles.table} ${styles.fixedTable}`}>
                  <thead>
                    <tr>
                      <th style={{ width: '30%' }}>Kunde</th>
                      <th style={{ width: '35%' }}>E-Mail</th>
                      <th style={{ width: '17.5%' }}>Bestellungen gesamt</th>
                      <th style={{ width: '17.5%' }}>Ø Bestellungen/Woche</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedCustomers.map((group) => {
                      const sumTotalOrders = group.customers.reduce((acc, c) => acc + c.totalOrders, 0);
                      const avgOrdersPerWeekAvg = group.customers.reduce((acc, c) => acc + c.avgOrdersPerWeek, 0) / (group.customers.length || 1);

                      return (
                        <React.Fragment key={group.label}>
                          <tr className={styles.groupHeaderRow}>
                            <td colSpan={4}>
                              {group.label} ({group.customers.length} {group.customers.length === 1 ? 'Kunde' : 'Kunden'})
                            </td>
                          </tr>
                          {group.customers.map((c) => (
                            <tr key={c.email}>
                              <td>{c.customerName}</td>
                              <td>{c.email}</td>
                              <td>{c.totalOrders}</td>
                              <td>{c.avgOrdersPerWeek.toFixed(1)}</td>
                            </tr>
                          ))}
                          <tr className={styles.summaryRow}>
                            <td>Gesamt</td>
                            <td></td>
                            <td>{sumTotalOrders}</td>
                            <td>{avgOrdersPerWeekAvg.toFixed(1)}</td>
                          </tr>
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CollapsibleContent>
        </div>
      </Collapsible>

      <div className={styles.sectionBox}>
        <h3>Seitenaufrufe</h3>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Seite</th>
                <th>Aufrufe</th>
                <th>Ø Verweildauer</th>
              </tr>
            </thead>
            <tbody>
              {data.pageVisits.map(pv => (
                <tr key={pv.pagePath}>
                  <td>{pv.pagePath}</td>
                  <td>{pv.visitCount}</td>
                  <td>{formatDuration(pv.avgDuration)}</td>
                </tr>
              ))}
              {data.pageVisits.length === 0 && (
                <tr>
                  <td colSpan={3}>Keine Daten verfügbar</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
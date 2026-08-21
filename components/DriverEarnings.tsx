import React, { useState } from 'react';
import { History, Calendar, CheckCircle, Package, Heart, Wallet } from 'lucide-react';
import { useDriverEarnings } from '../helpers/useDriverEarnings';
import { Spinner } from './Spinner';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from './Sheet';
import { Button } from './Button';
import { DriverCreditNotes } from './DriverCreditNotes';
import { companyCarDeduction } from '../helpers/companyCarDeduction';
import styles from './DriverEarnings.module.css';

/**
 * Computes block index and boundaries.
 * Reference date is set to Wednesday, Jan 1st 2025.
 */
function getBlockInfo(dateStr: string) {
  const ref = new Date(Date.UTC(2025, 0, 1));
  const d = new Date(dateStr);
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const daysDiff = Math.floor((target.getTime() - ref.getTime()) / (1000 * 60 * 60 * 24));
  const blockIndex = Math.floor(daysDiff / 14);
  const blockStart = new Date(ref.getTime() + blockIndex * 14 * 24 * 60 * 60 * 1000);
  const blockEnd = new Date(blockStart.getTime() + 13 * 24 * 60 * 60 * 1000);
  
  return { blockIndex, blockStart, blockEnd };
}

const formatCurrency = (val: number) => 
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(val);

const formatDate = (date: Date) => 
  new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);

const formatDateWithDay = (dateStr: string) => {
  return new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(dateStr));
};

export const DriverEarnings: React.FC = () => {
  const { data, isLoading, isError, error } = useDriverEarnings();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isMonthSheetOpen, setIsMonthSheetOpen] = useState(false);
  const [isPackagingSheetOpen, setIsPackagingSheetOpen] = useState(false);
  const [isPackagingMonthSheetOpen, setIsPackagingMonthSheetOpen] = useState(false);

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <Spinner size="lg" />
        <p>Verdienstdaten werden geladen...</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className={styles.errorContainer}>
        <p className={styles.errorText}>
          Fehler beim Laden der Verdienstdaten: {error instanceof Error ? error.message : 'Unbekannter Fehler'}
        </p>
      </div>
    );
  }

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const { blockIndex: currentBlockIndex, blockStart: currentBlockStart, blockEnd: currentBlockEnd } = getBlockInfo(now.toISOString());

  let blockStops = 0;
  let monthStops = 0;
  let totalStops = 0;

  let blockPackaging = 0;
  let monthPackaging = 0;
  let totalPackaging = 0;

  type BlockData = { stops: number; companyCarStops: number; carDeduction: number; earnings: number; startDate: Date; endDate: Date };
  type PkgBlockData = { count: number; earnings: number; startDate: Date; endDate: Date };
  type MonthData = { key: string, label: string; year: number; month: number; stops: number; companyCarStops: number; carDeduction: number; earnings: number };
  type PkgMonthData = { key: string, label: string; year: number; month: number; count: number; earnings: number };
  
  const blocks: Record<number, BlockData> = {};
  const pkgBlocks: Record<number, PkgBlockData> = {};
  const months: Record<string, MonthData> = {};
  const pkgMonths: Record<string, PkgMonthData> = {};

  let monthStopEarnings = 0;
  let blockStopEarnings = 0;

  const allDaysMap = new Map<string, { date: string; stopsCount: number; companyCarStops: number; stopEarnings: number; isPackaging: boolean; pkgEarnings: number }>();

  data.dailyEarnings.forEach((day) => {
    totalStops += day.stopsCount;
    
    const d = new Date(day.date);
    if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
      monthStops += day.stopsCount;
      monthStopEarnings += day.earnings;
    }
    
    const bInfo = getBlockInfo(day.date);
    if (bInfo.blockIndex === currentBlockIndex) {
      blockStops += day.stopsCount;
      blockStopEarnings += day.earnings;
    }
    
    if (!blocks[bInfo.blockIndex]) {
      blocks[bInfo.blockIndex] = {
        stops: 0,
        companyCarStops: 0,
        carDeduction: 0,
        earnings: 0,
        startDate: bInfo.blockStart,
        endDate: bInfo.blockEnd,
      };
    }
    blocks[bInfo.blockIndex].stops += day.stopsCount;
    blocks[bInfo.blockIndex].companyCarStops += (day.companyCarStops || 0);
    blocks[bInfo.blockIndex].carDeduction += (day.carDeduction || 0);
    blocks[bInfo.blockIndex].earnings += day.earnings;

    const yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!months[yearMonth]) {
      const monthLabel = new Intl.DateTimeFormat("de-DE", { month: "long" }).format(d) + " " + d.getFullYear();
      months[yearMonth] = {
        key: yearMonth,
        label: monthLabel,
        year: d.getFullYear(),
        month: d.getMonth(),
        stops: 0,
        companyCarStops: 0,
        carDeduction: 0,
        earnings: 0,
      };
    }
    months[yearMonth].stops += day.stopsCount;
    months[yearMonth].companyCarStops += (day.companyCarStops || 0);
    months[yearMonth].carDeduction += (day.carDeduction || 0);
    months[yearMonth].earnings += day.earnings;

    allDaysMap.set(day.date, {
      date: day.date,
      stopsCount: day.stopsCount,
      companyCarStops: day.companyCarStops || 0,
      stopEarnings: day.earnings,
      isPackaging: false,
      pkgEarnings: 0
    });
  });

  data.packagingDays.forEach((day) => {
    totalPackaging += 1;
    
    const d = new Date(day.date);
    if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
      monthPackaging += 1;
    }
    
    const bInfo = getBlockInfo(day.date);
    if (bInfo.blockIndex === currentBlockIndex) {
      blockPackaging += 1;
    }
    
    if (!pkgBlocks[bInfo.blockIndex]) {
      pkgBlocks[bInfo.blockIndex] = {
        count: 0,
        earnings: 0,
        startDate: bInfo.blockStart,
        endDate: bInfo.blockEnd,
      };
    }
    pkgBlocks[bInfo.blockIndex].count += 1;
    pkgBlocks[bInfo.blockIndex].earnings += data.packagingCompensation;

    const yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!pkgMonths[yearMonth]) {
      const monthLabel = new Intl.DateTimeFormat("de-DE", { month: "long" }).format(d) + " " + d.getFullYear();
      pkgMonths[yearMonth] = {
        key: yearMonth,
        label: monthLabel,
        year: d.getFullYear(),
        month: d.getMonth(),
        count: 0,
        earnings: 0,
      };
    }
    pkgMonths[yearMonth].count += 1;
    pkgMonths[yearMonth].earnings += data.packagingCompensation;

    if (allDaysMap.has(day.date)) {
      const existing = allDaysMap.get(day.date)!;
      existing.isPackaging = true;
      existing.pkgEarnings = data.packagingCompensation;
    } else {
      allDaysMap.set(day.date, {
        date: day.date,
        stopsCount: 0,
        companyCarStops: 0,
        stopEarnings: 0,
        isPackaging: true,
        pkgEarnings: data.packagingCompensation
      });
    }
  });

  const monthName = new Intl.DateTimeFormat("de-DE", { month: "long" }).format(now);
  
  // Sort blocks newest first
  const sortedBlocks = Object.entries(blocks)
    .map(([idx, bData]) => ({
      index: Number(idx),
      ...bData
    }))
    .sort((a, b) => b.index - a.index);

  const sortedPkgBlocks = Object.entries(pkgBlocks)
    .map(([idx, bData]) => ({
      index: Number(idx),
      ...bData
    }))
    .sort((a, b) => b.index - a.index);

  const sortedMonths = Object.values(months)
    .sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month);

  const sortedPkgMonths = Object.values(pkgMonths)
    .sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month);

  const consolidatedDays = Array.from(allDaysMap.values()).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Verdienstübersicht</h2>
        <div className={styles.pillsContainer}>
          <div className={styles.compensationInfo}>
            Stopvergütung: <strong>{formatCurrency(data.stopCompensation)} / Stop</strong>
          </div>
          {data.totalCompanyCarStops != null && data.totalCompanyCarStops > 0 && (
            <div className={styles.compensationInfo} style={{ backgroundColor: 'color-mix(in srgb, var(--warning) 15%, var(--surface))', color: 'var(--warning)' }}>
              Firmenwagen-Abzug: <strong>-{formatCurrency(companyCarDeduction)} / Stop</strong>
            </div>
          )}
          <div className={styles.compensationInfo}>
            Verpackungsvergütung: <strong>{formatCurrency(data.packagingCompensation)} / Tag</strong>
          </div>
        </div>
      </div>

      <div className={styles.cardsGrid}>
        {/* Clickable Block Card */}
        <button 
          className={`${styles.card} ${styles.cardClickable}`}
          onClick={() => setIsSheetOpen(true)}
        >
          <div className={styles.cardHeader}>
            <div>
              <h3 className={styles.cardTitle}>Stops im Block</h3>
              <p className={styles.cardSubtitle}>
                {formatDate(currentBlockStart)} - {formatDate(currentBlockEnd)}
              </p>
            </div>
            <History className={styles.cardIcon} size={24} />
          </div>
          <div className={styles.cardBody}>
            <div className={styles.cardValue}>{blockStops}</div>
            <div className={styles.cardSubvalue}>{formatCurrency(blockStopEarnings)}</div>
          </div>
        </button>

        {/* Month Card */}
        <button 
          className={`${styles.card} ${styles.cardClickable}`}
          onClick={() => setIsMonthSheetOpen(true)}
        >
          <div className={styles.cardHeader}>
            <div>
              <h3 className={styles.cardTitle}>Stops im Monat</h3>
              <p className={styles.cardSubtitle}>{monthName} {currentYear}</p>
            </div>
            <Calendar className={styles.cardIcon} size={24} />
          </div>
          <div className={styles.cardBody}>
            <div className={styles.cardValue}>{monthStops}</div>
            <div className={styles.cardSubvalue}>{formatCurrency(monthStopEarnings)}</div>
          </div>
        </button>

        {/* Total Card */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h3 className={styles.cardTitle}>Stops Gesamt</h3>
              <p className={styles.cardSubtitle}>Alle Zeiten</p>
            </div>
            <CheckCircle className={styles.cardIconStatic} size={24} />
          </div>
          <div className={styles.cardBody}>
            <div className={styles.cardValue}>{totalStops}</div>
            <div className={styles.cardSubvalue}>{formatCurrency(data.totalEarnings)}</div>
          </div>
        </div>
      </div>

      <h3 className={styles.sectionTitle}>Verpackungsvergütung</h3>
      <div className={styles.cardsGrid}>
        {/* Clickable Packaging Block Card */}
        <button 
          className={`${styles.card} ${styles.cardClickable}`}
          onClick={() => setIsPackagingSheetOpen(true)}
        >
          <div className={styles.cardHeader}>
            <div>
              <h3 className={styles.cardTitle}>Verpackungen im Block</h3>
              <p className={styles.cardSubtitle}>
                {formatDate(currentBlockStart)} - {formatDate(currentBlockEnd)}
              </p>
            </div>
            <Package className={styles.cardIcon} size={24} />
          </div>
          <div className={styles.cardBody}>
            <div className={styles.cardValue}>{blockPackaging}</div>
            <div className={styles.cardSubvalue}>{formatCurrency(blockPackaging * data.packagingCompensation)}</div>
          </div>
        </button>

        {/* Month Packaging Card */}
        <button 
          className={`${styles.card} ${styles.cardClickable}`}
          onClick={() => setIsPackagingMonthSheetOpen(true)}
        >
          <div className={styles.cardHeader}>
            <div>
              <h3 className={styles.cardTitle}>Verpackungen im Monat</h3>
              <p className={styles.cardSubtitle}>{monthName} {currentYear}</p>
            </div>
            <Calendar className={styles.cardIcon} size={24} />
          </div>
          <div className={styles.cardBody}>
            <div className={styles.cardValue}>{monthPackaging}</div>
            <div className={styles.cardSubvalue}>{formatCurrency(monthPackaging * data.packagingCompensation)}</div>
          </div>
        </button>

        {/* Total Packaging Card */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h3 className={styles.cardTitle}>Verpackungen Gesamt</h3>
              <p className={styles.cardSubtitle}>Alle Zeiten</p>
            </div>
            <CheckCircle className={styles.cardIconStatic} size={24} />
          </div>
          <div className={styles.cardBody}>
            <div className={styles.cardValue}>{totalPackaging}</div>
            <div className={styles.cardSubvalue}>{formatCurrency(data.totalPackagingEarnings)}</div>
          </div>
        </div>
      </div>

      <h3 className={styles.sectionTitle}>Trinkgeld-Punktekonto</h3>
      <div className={styles.cardsGrid}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h3 className={styles.cardTitle}>Aktuelles Guthaben</h3>
              <p className={styles.cardSubtitle}>Trinkgeld-Punkte</p>
            </div>
            <Wallet className={styles.cardIconStatic} size={24} />
          </div>
          <div className={styles.cardBody}>
            <div className={styles.cardValue}>{formatCurrency(data.driverPointsBalance)}</div>
          </div>
        </div>
        
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h3 className={styles.cardTitle}>Trinkgeld Gesamt</h3>
              <p className={styles.cardSubtitle}>Alle Zeiten</p>
            </div>
            <Heart className={styles.cardIconStatic} size={24} />
          </div>
          <div className={styles.cardBody}>
            <div className={styles.cardValue}>{formatCurrency(data.totalTipsReceived)}</div>
          </div>
        </div>
      </div>

      <div className={styles.tableSection}>
        <h3 className={styles.tableTitle}>Tägliche Übersicht (max. 42 Tage)</h3>
        {consolidatedDays.length === 0 ? (
          <p className={styles.emptyState}>Keine Lieferungen oder Verpackungen gefunden.</p>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Datum</th>
                  <th className={styles.alignRight}>Stops</th>
                  <th className={styles.alignCenter}>Firmenwagen</th>
                  <th className={styles.alignCenter}>Verpackung</th>
                  <th className={styles.alignRight}>Verdienst / Pack</th>
                  <th className={styles.alignRight}>Verdienst / Stops</th>
                  <th className={styles.alignRight}>Gesamt</th>
                </tr>
              </thead>
              <tbody>
                {consolidatedDays.slice(0, 42).map((day) => (
                  <tr key={day.date}>
                    <td>{formatDateWithDay(day.date)}</td>
                    <td className={styles.alignRight}>{day.stopsCount}</td>
                    <td className={styles.alignCenter}>{day.companyCarStops > 0 ? day.companyCarStops : "—"}</td>
                    <td className={styles.alignCenter}>{day.isPackaging ? "✓" : "—"}</td>
                    <td className={styles.alignRight}>{formatCurrency(day.pkgEarnings)}</td>
                    <td className={styles.alignRight}>{formatCurrency(day.stopEarnings)}</td>
                    <td className={styles.alignRight}>{formatCurrency(day.stopEarnings + day.pkgEarnings)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Stops Block History Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Block Historie (Stops)</SheetTitle>
            <SheetDescription>
              Historische 14-Tage Blöcke für die Abrechnung.
            </SheetDescription>
          </SheetHeader>
          
          <div className={styles.sheetBody}>
            {sortedBlocks.length === 0 ? (
              <p className={styles.emptyState}>Keine historischen Blöcke vorhanden.</p>
            ) : (
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Zeitraum</th>
                      <th className={styles.alignRight}>Stops</th>
                      <th className={styles.alignRight}>Verdienst</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedBlocks.map((b) => (
                      <React.Fragment key={b.index}>
                        <tr className={b.index === currentBlockIndex ? styles.highlightRow : undefined}>
                          <td>
                            {formatDate(b.startDate)} - {formatDate(b.endDate)}
                            {b.index === currentBlockIndex && (
                              <span className={styles.currentBadge}>Aktuell</span>
                            )}
                          </td>
                          <td className={styles.alignRight}>{b.stops}</td>
                          <td className={styles.alignRight}>{formatCurrency(b.earnings)}</td>
                        </tr>
                        {b.carDeduction > 0 && (
                          <tr className={b.index === currentBlockIndex ? styles.highlightRow : undefined}>
                            <td colSpan={3} style={{ borderTop: 'none', paddingTop: 0, paddingBottom: '0.5rem', color: 'var(--muted-foreground)', fontSize: '0.8rem', textAlign: 'right' }}>
                              Abzug Firmenwagen: -{formatCurrency(b.carDeduction)}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th>Gesamt</th>
                      <th className={styles.alignRight}>
                        {sortedBlocks.reduce((acc, curr) => acc + curr.stops, 0)}
                      </th>
                      <th className={styles.alignRight}>
                        {formatCurrency(sortedBlocks.reduce((acc, curr) => acc + curr.earnings, 0))}
                      </th>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
          
          <SheetFooter>
            <Button variant="outline" onClick={() => setIsSheetOpen(false)}>Schließen</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Month History Sheet */}
      <Sheet open={isMonthSheetOpen} onOpenChange={setIsMonthSheetOpen}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Monatshistorie (Stops)</SheetTitle>
            <SheetDescription>
              Historische Monatsübersicht der Stops.
            </SheetDescription>
          </SheetHeader>
          
          <div className={styles.sheetBody}>
            {sortedMonths.length === 0 ? (
              <p className={styles.emptyState}>Keine monatlichen Daten vorhanden.</p>
            ) : (
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Monat</th>
                      <th className={styles.alignRight}>Stops</th>
                      <th className={styles.alignRight}>Verdienst</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedMonths.map((m) => (
                      <React.Fragment key={m.key}>
                        <tr className={(m.month === currentMonth && m.year === currentYear) ? styles.highlightRow : undefined}>
                          <td>
                            {m.label}
                            {(m.month === currentMonth && m.year === currentYear) && (
                              <span className={styles.currentBadge}>Aktuell</span>
                            )}
                          </td>
                          <td className={styles.alignRight}>{m.stops}</td>
                          <td className={styles.alignRight}>{formatCurrency(m.earnings)}</td>
                        </tr>
                        {m.carDeduction > 0 && (
                          <tr className={(m.month === currentMonth && m.year === currentYear) ? styles.highlightRow : undefined}>
                            <td colSpan={3} style={{ borderTop: 'none', paddingTop: 0, paddingBottom: '0.5rem', color: 'var(--muted-foreground)', fontSize: '0.8rem', textAlign: 'right' }}>
                              Abzug Firmenwagen: -{formatCurrency(m.carDeduction)}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th>Gesamt</th>
                      <th className={styles.alignRight}>
                        {sortedMonths.reduce((acc, curr) => acc + curr.stops, 0)}
                      </th>
                      <th className={styles.alignRight}>
                        {formatCurrency(sortedMonths.reduce((acc, curr) => acc + curr.earnings, 0))}
                      </th>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
          
          <SheetFooter>
            <Button variant="outline" onClick={() => setIsMonthSheetOpen(false)}>Schließen</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Packaging Block History Sheet */}
      <Sheet open={isPackagingSheetOpen} onOpenChange={setIsPackagingSheetOpen}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Block Historie (Verpackungen)</SheetTitle>
            <SheetDescription>
              Historische 14-Tage Blöcke für die Abrechnung von Verpackungstagen.
            </SheetDescription>
          </SheetHeader>
          
          <div className={styles.sheetBody}>
            {sortedPkgBlocks.length === 0 ? (
              <p className={styles.emptyState}>Keine historischen Blöcke vorhanden.</p>
            ) : (
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Zeitraum</th>
                      <th className={styles.alignRight}>Tage</th>
                      <th className={styles.alignRight}>Verdienst</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPkgBlocks.map((b) => (
                      <tr 
                        key={b.index} 
                        className={b.index === currentBlockIndex ? styles.highlightRow : undefined}
                      >
                        <td>
                          {formatDate(b.startDate)} - {formatDate(b.endDate)}
                          {b.index === currentBlockIndex && (
                            <span className={styles.currentBadge}>Aktuell</span>
                          )}
                        </td>
                        <td className={styles.alignRight}>{b.count}</td>
                        <td className={styles.alignRight}>{formatCurrency(b.earnings)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th>Gesamt</th>
                      <th className={styles.alignRight}>
                        {sortedPkgBlocks.reduce((acc, curr) => acc + curr.count, 0)}
                      </th>
                      <th className={styles.alignRight}>
                        {formatCurrency(sortedPkgBlocks.reduce((acc, curr) => acc + curr.earnings, 0))}
                      </th>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
          
          <SheetFooter>
            <Button variant="outline" onClick={() => setIsPackagingSheetOpen(false)}>Schließen</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Packaging Month History Sheet */}
      <Sheet open={isPackagingMonthSheetOpen} onOpenChange={setIsPackagingMonthSheetOpen}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Monatshistorie (Verpackungen)</SheetTitle>
            <SheetDescription>
              Historische Monatsübersicht der Verpackungstage.
            </SheetDescription>
          </SheetHeader>
          
          <div className={styles.sheetBody}>
            {sortedPkgMonths.length === 0 ? (
              <p className={styles.emptyState}>Keine monatlichen Daten vorhanden.</p>
            ) : (
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Monat</th>
                      <th className={styles.alignRight}>Tage</th>
                      <th className={styles.alignRight}>Verdienst</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPkgMonths.map((m) => (
                      <tr 
                        key={m.key} 
                        className={(m.month === currentMonth && m.year === currentYear) ? styles.highlightRow : undefined}
                      >
                        <td>
                          {m.label}
                          {(m.month === currentMonth && m.year === currentYear) && (
                            <span className={styles.currentBadge}>Aktuell</span>
                          )}
                        </td>
                        <td className={styles.alignRight}>{m.count}</td>
                        <td className={styles.alignRight}>{formatCurrency(m.earnings)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th>Gesamt</th>
                      <th className={styles.alignRight}>
                        {sortedPkgMonths.reduce((acc, curr) => acc + curr.count, 0)}
                      </th>
                      <th className={styles.alignRight}>
                        {formatCurrency(sortedPkgMonths.reduce((acc, curr) => acc + curr.earnings, 0))}
                      </th>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
          
          <SheetFooter>
            <Button variant="outline" onClick={() => setIsPackagingMonthSheetOpen(false)}>Schließen</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <DriverCreditNotes />
    </div>
  );
};
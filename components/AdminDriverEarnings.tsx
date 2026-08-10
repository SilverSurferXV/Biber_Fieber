import React, { useState, useEffect } from 'react';
import { History, Calendar, CheckCircle, Package, FileText, Coins, Heart } from 'lucide-react';
import { useAdminDrivers } from '../helpers/useAdminDriverApi';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './Dialog';
import { generateGutschriftPdf, GutschriftData } from '../helpers/generateGutschriftPdf';
import { useAdminDriverEarnings, useUpdateDriverCompensation } from '../helpers/useAdminDriverEarnings';
import { useAdminCreditNotes, useSaveCreditNote } from '../helpers/useDriverCreditNotes';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './Select';
import { Badge } from './Badge';
import { Input } from './Input';
import { Button } from './Button';
import { Spinner } from './Spinner';
import { toast } from 'sonner';
import styles from './AdminDriverEarnings.module.css';

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

export const AdminDriverEarnings = () => {
  const { data: drivers, isLoading: isDriversLoading } = useAdminDrivers();
  const { mutateAsync: updateComp, isPending: isSaving } = useUpdateDriverCompensation();
  const { mutateAsync: saveCreditNote } = useSaveCreditNote();
  
  const [selectedDriverId, setSelectedDriverId] = useState<number | null>(null);

  const { data: creditNotes, isLoading: isCreditNotesLoading } = useAdminCreditNotes(selectedDriverId ?? undefined);
  const [stopCompInput, setStopCompInput] = useState<string>("");
  const [packCompInput, setPackCompInput] = useState<string>("");
  const [abrechnungOpen, setAbrechnungOpen] = useState(false);

  const { data: earningsData, isFetching: isEarningsLoading, isError: isEarningsError } = useAdminDriverEarnings(selectedDriverId ?? undefined);

  const selectedDriver = drivers?.find(d => d.id === selectedDriverId);

  useEffect(() => {
    if (selectedDriver) {
      setStopCompInput(selectedDriver.stopCompensation?.toString() ?? "0");
      setPackCompInput(selectedDriver.packagingCompensation?.toString() ?? "0");
    }
  }, [selectedDriver]);

  const availableBlocks = React.useMemo(() => {
    const now = new Date().toISOString();
    const currentBlockIndex = getBlockInfo(now).blockIndex;
    
    const blocks = [];
    for (let i = 0; i < 26; i++) {
      const index = currentBlockIndex - i;
      const ref = new Date(Date.UTC(2025, 0, 1));
      const blockStart = new Date(ref.getTime() + index * 14 * 24 * 60 * 60 * 1000);
      const blockEnd = new Date(blockStart.getTime() + 13 * 24 * 60 * 60 * 1000);
      
      let hasData = false;
      if (earningsData) {
        const hasEarnings = earningsData.dailyEarnings.some(d => getBlockInfo(d.date).blockIndex === index);
        const hasPackaging = earningsData.packagingDays.some(d => getBlockInfo(d.date).blockIndex === index);
        hasData = hasEarnings || hasPackaging;
      }

      blocks.push({
        blockIndex: index,
        blockStart,
        blockEnd,
        label: `${formatDate(blockStart)} – ${formatDate(blockEnd)}`,
        hasData
      });
    }
    return blocks;
  }, [earningsData]);

  const handleGenerateGutschrift = async (block: { blockIndex: number; blockStart: Date; blockEnd: Date; label: string; hasData?: boolean }) => {
    if (!selectedDriver || !earningsData) return;

    const filteredDaily = earningsData.dailyEarnings.filter(
      d => getBlockInfo(d.date).blockIndex === block.blockIndex
    );
    const filteredPackaging = earningsData.packagingDays.filter(
      d => getBlockInfo(d.date).blockIndex === block.blockIndex
    );

    const payload: GutschriftData = {
      driverName: `${selectedDriver.firstName || ""} ${selectedDriver.lastName || ""}`.trim() || "-",
      driverEmail: selectedDriver.email,
      invoiceCompanyName: selectedDriver.invoiceCompanyName,
      invoiceStreet: selectedDriver.invoiceStreet,
      invoiceHouseNumber: selectedDriver.invoiceHouseNumber,
      invoicePostcode: selectedDriver.invoicePostcode,
      invoiceCity: selectedDriver.invoiceCity,
      invoiceTaxId: selectedDriver.invoiceTaxId,
      invoiceTaxNumber: selectedDriver.invoiceTaxNumber,
      vatEligible: selectedDriver.vatEligible ?? false,
      blockStart: block.blockStart,
      blockEnd: block.blockEnd,
      stopCompensation: earningsData.stopCompensation,
      packagingCompensation: earningsData.packagingCompensation,
      dailyEarnings: filteredDaily,
      packagingDays: filteredPackaging,
    };

        try {
      await generateGutschriftPdf(payload);
      
      const totalStopEarnings = filteredDaily.reduce((sum, d) => sum + d.earnings, 0);
      console.log('[DEBUG] detailData being sent:', JSON.stringify({
        driverName: payload.driverName,
        driverEmail: payload.driverEmail,
        vatEligible: payload.vatEligible,
        dailyEarningsCount: filteredDaily.length,
        packagingDaysCount: filteredPackaging.length,
      }));
      const totalPackagingEarnings = filteredPackaging.length * earningsData.packagingCompensation;
      const grandTotal = totalStopEarnings + totalPackagingEarnings;
      const vatEligible = selectedDriver.vatEligible ?? false;
      const vatAmount = vatEligible ? grandTotal * 0.07 : null;
      
      const gutschriftNumber = `GS-${block.blockStart.getFullYear()}-${String(block.blockStart.getMonth() + 1).padStart(2, '0')}-${String(block.blockStart.getDate()).padStart(2, '0')}`;
      
      await saveCreditNote({
        driverId: selectedDriver.id,
        gutschriftNumber,
        blockStart: block.blockStart,
        blockEnd: block.blockEnd,
        stopCompensation: earningsData.stopCompensation,
        packagingCompensation: earningsData.packagingCompensation,
        totalStopEarnings,
        totalPackagingEarnings,
        totalAmount: vatEligible ? grandTotal + grandTotal * 0.07 : grandTotal,
        vatAmount,
        detailData: {
          driverName: payload.driverName,
          driverEmail: payload.driverEmail,
          invoiceCompanyName: payload.invoiceCompanyName ?? null,
          invoiceStreet: payload.invoiceStreet ?? null,
          invoiceHouseNumber: payload.invoiceHouseNumber ?? null,
          invoicePostcode: payload.invoicePostcode ?? null,
          invoiceCity: payload.invoiceCity ?? null,
          invoiceTaxId: payload.invoiceTaxId ?? null,
          invoiceTaxNumber: payload.invoiceTaxNumber ?? null,
          vatEligible: payload.vatEligible,
          dailyEarnings: filteredDaily,
          packagingDays: filteredPackaging,
        },
      });

      toast.success("Gutschrift erstellt und gespeichert");
      setAbrechnungOpen(false);
    } catch (e) {
      console.error(e);
      toast.error("Fehler beim Erstellen der Abrechnung");
    }
  };

  const handleSaveCompensation = async () => {
    if (!selectedDriver) return;
    
    try {
      const payload = {
        id: selectedDriver.id,
        firstName: selectedDriver.firstName || "-",
        lastName: selectedDriver.lastName || "-",
        email: selectedDriver.email,
        mobileNumber: selectedDriver.mobileNumber || undefined,
        billingCompanyName: selectedDriver.billingCompanyName || undefined,
        billingStreet: selectedDriver.billingStreet || undefined,
        billingCity: selectedDriver.billingCity || undefined,
        billingPostcode: selectedDriver.billingPostcode || undefined,
        billingCountry: selectedDriver.billingCountry || undefined,
        billingTaxNumber: selectedDriver.billingTaxNumber || undefined,
        packagingCompensation: parseFloat(packCompInput) || 0,
        stopCompensation: parseFloat(stopCompInput) || 0,
      };

      await updateComp(payload);
      toast.success("Vergütung erfolgreich gespeichert");
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : "Fehler beim Speichern";
      toast.error(errorMessage);
    }
  };

  const renderEarningsOverview = () => {
    if (isEarningsLoading) {
      return (
        <div className={styles.loadingContainer}>
          <Spinner size="lg" />
          <p>Verdienstdaten werden geladen...</p>
        </div>
      );
    }

    if (isEarningsError || !earningsData) {
      return (
        <div className={styles.emptyContainer}>
          <p>Daten konnten nicht geladen werden.</p>
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

    const allDaysMap = new Map<string, { date: string; stopsCount: number; stopEarnings: number; isPackaging: boolean; pkgEarnings: number }>();

    earningsData.dailyEarnings.forEach((day) => {
      totalStops += day.stopsCount;
      const d = new Date(day.date);
      if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
        monthStops += day.stopsCount;
      }
      
      const bInfo = getBlockInfo(day.date);
      if (bInfo.blockIndex === currentBlockIndex) {
        blockStops += day.stopsCount;
      }
      
      allDaysMap.set(day.date, {
        date: day.date,
        stopsCount: day.stopsCount,
        stopEarnings: day.earnings,
        isPackaging: false,
        pkgEarnings: 0
      });
    });

    earningsData.packagingDays.forEach((day) => {
      totalPackaging += 1;
      const d = new Date(day.date);
      if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
        monthPackaging += 1;
      }
      
      const bInfo = getBlockInfo(day.date);
      if (bInfo.blockIndex === currentBlockIndex) {
        blockPackaging += 1;
      }
      
      if (allDaysMap.has(day.date)) {
        const existing = allDaysMap.get(day.date)!;
        existing.isPackaging = true;
        existing.pkgEarnings = earningsData.packagingCompensation;
      } else {
        allDaysMap.set(day.date, {
          date: day.date,
          stopsCount: 0,
          stopEarnings: 0,
          isPackaging: true,
          pkgEarnings: earningsData.packagingCompensation
        });
      }
    });

    const monthName = new Intl.DateTimeFormat("de-DE", { month: "long" }).format(now);
    const consolidatedDays = Array.from(allDaysMap.values()).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return (
      <div className={styles.tableSection}>
        <h3 className={styles.sectionTitle}>Stopvergütung</h3>
        <div className={styles.cardsGrid}>
          <div className={styles.card}>
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
              <div className={styles.cardSubvalue}>{formatCurrency(blockStops * earningsData.stopCompensation)}</div>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h3 className={styles.cardTitle}>Stops im Monat</h3>
                <p className={styles.cardSubtitle}>{monthName} {currentYear}</p>
              </div>
              <Calendar className={styles.cardIcon} size={24} />
            </div>
            <div className={styles.cardBody}>
              <div className={styles.cardValue}>{monthStops}</div>
              <div className={styles.cardSubvalue}>{formatCurrency(monthStops * earningsData.stopCompensation)}</div>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h3 className={styles.cardTitle}>Stops Gesamt</h3>
                <p className={styles.cardSubtitle}>Alle Zeiten</p>
              </div>
              <CheckCircle className={styles.cardIcon} size={24} />
            </div>
            <div className={styles.cardBody}>
              <div className={styles.cardValue}>{totalStops}</div>
              <div className={styles.cardSubvalue}>{formatCurrency(earningsData.totalEarnings)}</div>
            </div>
          </div>
        </div>

        <h3 className={styles.sectionTitle}>Verpackungsvergütung</h3>
        <div className={styles.cardsGrid}>
          <div className={styles.card}>
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
              <div className={styles.cardSubvalue}>{formatCurrency(blockPackaging * earningsData.packagingCompensation)}</div>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h3 className={styles.cardTitle}>Verpackungen im Monat</h3>
                <p className={styles.cardSubtitle}>{monthName} {currentYear}</p>
              </div>
              <Calendar className={styles.cardIcon} size={24} />
            </div>
            <div className={styles.cardBody}>
              <div className={styles.cardValue}>{monthPackaging}</div>
              <div className={styles.cardSubvalue}>{formatCurrency(monthPackaging * earningsData.packagingCompensation)}</div>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h3 className={styles.cardTitle}>Verpackungen Gesamt</h3>
                <p className={styles.cardSubtitle}>Alle Zeiten</p>
              </div>
              <CheckCircle className={styles.cardIcon} size={24} />
            </div>
            <div className={styles.cardBody}>
              <div className={styles.cardValue}>{totalPackaging}</div>
              <div className={styles.cardSubvalue}>{formatCurrency(earningsData.totalPackagingEarnings)}</div>
            </div>
          </div>
        </div>

        <h3 className={styles.sectionTitle}>Trinkgeld-Punktekonto</h3>
        <div className={styles.cardsGrid}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h3 className={styles.cardTitle}>Aktuelles Guthaben</h3>
                <p className={styles.cardSubtitle}>Verfügbare Punkte</p>
              </div>
              <Coins className={styles.cardIcon} size={24} />
            </div>
            <div className={styles.cardBody}>
              <div className={styles.cardValue}>{formatCurrency(earningsData.driverPointsBalance)}</div>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h3 className={styles.cardTitle}>Trinkgeld Gesamt</h3>
                <p className={styles.cardSubtitle}>Alle Zeiten</p>
              </div>
              <Heart className={styles.cardIcon} size={24} />
            </div>
            <div className={styles.cardBody}>
              <div className={styles.cardValue}>{formatCurrency(earningsData.totalTipsReceived)}</div>
            </div>
          </div>
        </div>

        <h3 className={styles.sectionTitle}>Tägliche Übersicht (letzte 42 Tage)</h3>
        {consolidatedDays.length === 0 ? (
          <div className={styles.emptyContainer}>Keine Lieferungen oder Verpackungen gefunden.</div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Datum</th>
                  <th className={styles.alignRight}>Stops</th>
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
    );
  };

  const renderCreditNotes = () => {
    if (!selectedDriver) return null;
    if (isCreditNotesLoading) {
      return (
        <div className={styles.loadingContainer}>
          <Spinner size="lg" />
          <p>Lade Gutschriften...</p>
        </div>
      );
    }
    if (!creditNotes || creditNotes.length === 0) {
      return null;
    }

    return (
      <div className={styles.tableSection}>
        <h3 className={styles.sectionTitle}>Gutschrift-Rechnungen</h3>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Gutschriftsnummer</th>
                <th>Zeitraum</th>
                <th className={styles.alignRight}>Gesamtbetrag</th>
                <th>Status</th>
                <th>Freigegeben am</th>
                <th>Erstellt am</th>
              </tr>
            </thead>
            <tbody>
              {creditNotes.map((cn) => (
                <tr key={cn.id}>
                  <td>{cn.gutschriftNumber}</td>
                  <td>
                    {formatDate(new Date(cn.blockStart))} - {formatDate(new Date(cn.blockEnd))}
                  </td>
                  <td className={styles.alignRight}>{formatCurrency(cn.totalAmount)}</td>
                  <td>
                    {cn.status === "pending" && <Badge variant="warning">Ausstehend</Badge>}
                    {cn.status === "approved_manual" && <Badge variant="success">Manuell freigegeben</Badge>}
                    {cn.status === "approved_auto" && <Badge variant="primary">Automatisch freigegeben</Badge>}
                  </td>
                  <td>{cn.approvedAt ? formatDate(new Date(cn.approvedAt)) : "—"}</td>
                  <td>{formatDate(new Date(cn.createdAt))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.headerCard}>
        <div className={styles.selectorWrapper}>
          <label>Fahrer auswählen</label>
          <Select 
            value={selectedDriverId?.toString() ?? "__empty"} 
            onValueChange={(v) => setSelectedDriverId(v === "__empty" ? null : Number(v))}
            disabled={isDriversLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder={isDriversLoading ? "Lade Fahrer..." : "Fahrer auswählen..."} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__empty">Bitte wählen...</SelectItem>
              {(drivers || []).map((d) => (
                <SelectItem key={d.id} value={d.id.toString()}>
                  {d.firstName} {d.lastName} ({d.email})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedDriver && (
          <div className={styles.compensationForm}>
            <div className={styles.inputGroup}>
              <label>Stopvergütung (€)</label>
              <Input 
                type="number" 
                step="0.01" 
                value={stopCompInput} 
                onChange={(e) => setStopCompInput(e.target.value)} 
              />
            </div>
            <div className={styles.inputGroup}>
              <label>Verpackungsvergütung (€)</label>
              <Input 
                type="number" 
                step="0.01" 
                value={packCompInput} 
                onChange={(e) => setPackCompInput(e.target.value)} 
              />
            </div>
        <Button onClick={handleSaveCompensation} disabled={isSaving}>
          {isSaving ? "Speichert..." : "Speichern"}
        </Button>
        <Button 
          variant="outline" 
          onClick={() => setAbrechnungOpen(true)} 
          disabled={!earningsData || isEarningsLoading}
        >
          <FileText size={16} /> Abrechnung
        </Button>
      </div>
    )}
  </div>

  <Dialog open={abrechnungOpen} onOpenChange={setAbrechnungOpen}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Abrechnungsblock wählen</DialogTitle>
      </DialogHeader>
      <div className={styles.dialogBlockList}>
        {availableBlocks.map(block => (
          <Button key={block.blockIndex} variant="outline" onClick={() => handleGenerateGutschrift(block)}>
            {block.label} {!block.hasData && <span className={styles.emptyBlockText}>(Keine Daten)</span>}
          </Button>
        ))}
        {availableBlocks.length === 0 && (
          <p className={styles.dialogEmptyText}>
            Keine Abrechnungsblöcke verfügbar.
          </p>
        )}
      </div>
    </DialogContent>
  </Dialog>

  {selectedDriver ? (
        <>
          {renderEarningsOverview()}
          {renderCreditNotes()}
        </>
      ) : (
        <div className={styles.emptyContainer}>
          <p>Bitte wählen Sie einen Fahrer aus der Liste, um dessen Verdienste einzusehen.</p>
        </div>
      )}
    </div>
  );
};
import React, { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { useDriverCreditNotes, useApproveCreditNote } from "../helpers/useDriverCreditNotes";
import { Spinner } from "./Spinner";
import { Badge } from "./Badge";
import { Button } from "./Button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "./Sheet";
import { generateGutschriftPdf } from "../helpers/generateGutschriftPdf";
import type { DriverCreditNoteItem } from "../endpoints/driver/credit-notes_GET.schema";
import styles from "./DriverCreditNotes.module.css";

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(val);

const formatDate = (date: Date | string) =>
  new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(date));

const formatDateTime = (date: Date | string) =>
  new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));

const formatDateWithWeekday = (dateStr: string | Date) => {
  return new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(dateStr));
};

function getRemainingTime(expiresAt: Date | string): string {
  const now = new Date().getTime();
  const target = new Date(expiresAt).getTime();
  const diff = target - now;
  
  if (diff <= 0) return "Abgelaufen";
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) return `${days}t ${hours}std`;
  if (hours > 0) return `${hours}std ${minutes}min`;
  return `${minutes}min`;
}

export const DriverCreditNotes: React.FC = () => {
  const { data: notes, isLoading, isError, error } = useDriverCreditNotes();
  const approveMutation = useApproveCreditNote();
  const [tick, setTick] = useState(0);
  
  const [selectedNote, setSelectedNote] = useState<DriverCreditNoteItem | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Update countdown every minute
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  const handleOpenPdf = async () => {
    if (!selectedNote?.detailData) return;
    setIsGeneratingPdf(true);
    try {
      const d = selectedNote.detailData;
      await generateGutschriftPdf({
        driverName: d.driverName,
        driverEmail: d.driverEmail,
        invoiceCompanyName: d.invoiceCompanyName,
        invoiceStreet: d.invoiceStreet,
        invoiceHouseNumber: d.invoiceHouseNumber,
        invoicePostcode: d.invoicePostcode,
        invoiceCity: d.invoiceCity,
        invoiceTaxId: d.invoiceTaxId,
        invoiceTaxNumber: d.invoiceTaxNumber,
        vatEligible: d.vatEligible,
        blockStart: new Date(selectedNote.blockStart),
        blockEnd: new Date(selectedNote.blockEnd),
        stopCompensation: selectedNote.stopCompensation,
        packagingCompensation: selectedNote.packagingCompensation,
        dailyEarnings: d.dailyEarnings,
        packagingDays: d.packagingDays,
      });
    } catch (e) {
      console.error('PDF generation failed', e);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <Spinner size="lg" />
        <p>Gutschrift-Rechnungen werden geladen...</p>
      </div>
    );
  }

  if (isError || !notes) {
    return (
      <div className={styles.errorContainer}>
        <p className={styles.errorText}>
          Fehler beim Laden der Gutschriften: {error instanceof Error ? error.message : "Unbekannter Fehler"}
        </p>
      </div>
    );
  }

  const selectedTotalWithVat = selectedNote ? selectedNote.totalAmount + (selectedNote.vatAmount || 0) : 0;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleWrapper}>
          <FileText className={styles.headerIcon} size={28} />
          <h2 className={styles.title}>Gutschrift-Rechnungen</h2>
        </div>
      </div>

      <div className={styles.tableSection}>
        {notes.length === 0 ? (
          <p className={styles.emptyState}>Keine Gutschrift-Rechnungen vorhanden.</p>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Gutschriftsnummer</th>
                  <th>Zeitraum</th>
                  <th className={styles.alignRight}>Stopvergütung</th>
                  <th className={styles.alignRight}>Verpackung</th>
                  <th className={styles.alignRight}>Gesamtbetrag</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {notes.map((note) => {
                  const totalWithVat = note.totalAmount + (note.vatAmount || 0);

                  return (
                    <tr 
                      key={note.id} 
                      className={styles.clickableRow}
                      onClick={() => setSelectedNote(note)}
                    >
                      <td className={styles.fw500}>{note.gutschriftNumber}</td>
                      <td>
                        {formatDate(note.blockStart)} - {formatDate(note.blockEnd)}
                      </td>
                      <td className={styles.alignRight}>{formatCurrency(note.totalStopEarnings)}</td>
                      <td className={styles.alignRight}>{formatCurrency(note.totalPackagingEarnings)}</td>
                      <td className={styles.alignRight}>
                        <span className={styles.fw600}>{formatCurrency(totalWithVat)}</span>
                        {note.vatAmount ? (
                          <div className={styles.subText}>inkl. MwSt.</div>
                        ) : null}
                      </td>
                      <td className={styles.statusCell}>
                        {note.status === "pending" ? (
                          <div className={styles.actionContainer}>
                            <div className={styles.badgeWrapper}>
                              <Badge variant="warning">Ausstehend</Badge>
                              <span className={styles.countdown}>
                                Noch {getRemainingTime(note.expiresAt)}
                              </span>
                            </div>
                            <Button
                              size="sm"
                              className={styles.approveButton}
                              onClick={(e) => {
                                e.stopPropagation();
                                approveMutation.mutate(note.id);
                              }}
                              disabled={approveMutation.isPending}
                            >
                              {approveMutation.isPending ? <Spinner size="sm" /> : "Freigeben"}
                            </Button>
                          </div>
                        ) : note.status === "approved_manual" ? (
                          <div className={styles.actionContainer}>
                            <Badge variant="success">Manuell freigegeben</Badge>
                            <span className={styles.dateHint}>
                              {note.approvedAt ? formatDateTime(note.approvedAt) : ""}
                            </span>
                          </div>
                        ) : (
                          <div className={styles.actionContainer}>
                            <Badge className={styles.blueBadge}>Automatisch freigegeben</Badge>
                            <span className={styles.dateHint}>
                              {note.approvedAt ? formatDateTime(note.approvedAt) : ""}
                            </span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Sheet open={!!selectedNote} onOpenChange={(open) => !open && setSelectedNote(null)}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Gutschrift {selectedNote?.gutschriftNumber}</SheetTitle>
          </SheetHeader>
          <div className={styles.sheetBody}>
            {selectedNote && selectedNote.detailData ? (
              <div className={styles.gutschriftWebView}>
                {/* Sender Info */}
                <div className={styles.senderBlock}>
                  <strong>Biber Fieber UG (haftungsbeschränkt)</strong>
                  <p>Am Hartholz 3</p>
                  <p>82239 Alling</p>
                  <p>UST ID: DE 366 184 903</p>
                  <p>STEUER NR: 117 / 122 / 40433</p>
                </div>
                
                <div className={styles.dividerLine} />
                
                <h2 className={styles.gutschriftTitle}>GUTSCHRIFT RECHNUNG</h2>
                
                <div className={styles.dividerLine} />
                
                {/* Meta & Recipient */}
                <div className={styles.metaRow}>
                  <div className={styles.recipientBlock}>
                    {selectedNote.detailData.invoiceCompanyName && <strong>{selectedNote.detailData.invoiceCompanyName}</strong>}
                    {!selectedNote.detailData.invoiceCompanyName && <strong>{selectedNote.detailData.driverName}</strong>}
                    {selectedNote.detailData.invoiceCompanyName && selectedNote.detailData.driverName && <p>z.Hd. {selectedNote.detailData.driverName}</p>}
                    {(selectedNote.detailData.invoiceStreet || selectedNote.detailData.invoiceHouseNumber) && (
                      <p>{[selectedNote.detailData.invoiceStreet, selectedNote.detailData.invoiceHouseNumber].filter(Boolean).join(' ')}</p>
                    )}
                    {(selectedNote.detailData.invoicePostcode || selectedNote.detailData.invoiceCity) && (
                      <p>{[selectedNote.detailData.invoicePostcode, selectedNote.detailData.invoiceCity].filter(Boolean).join(' ')}</p>
                    )}
                    {selectedNote.detailData.driverEmail && <p>Email: {selectedNote.detailData.driverEmail}</p>}
                    {selectedNote.detailData.invoiceTaxId && <p>UST ID: {selectedNote.detailData.invoiceTaxId}</p>}
                    {selectedNote.detailData.invoiceTaxNumber && <p>Steuernummer: {selectedNote.detailData.invoiceTaxNumber}</p>}
                  </div>
                  <div className={styles.metaInfo}>
                    <p><strong>Gutschriftsnummer:</strong></p>
                    <p>{selectedNote.gutschriftNumber}</p>
                    <p style={{marginTop: '0.5rem'}}><strong>Leistungszeitraum:</strong></p>
                    <p>{formatDate(selectedNote.blockStart)} – {formatDate(selectedNote.blockEnd)}</p>
                  </div>
                </div>
                
                {/* Stop Earnings Table */}
                <h3 className={styles.webSectionTitle}>Stopvergütung ({formatCurrency(selectedNote.stopCompensation)} / Stop)</h3>
                <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Datum</th>
                        <th className={styles.alignRight}>Anzahl Stops</th>
                        <th className={styles.alignRight}>Betrag</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedNote.detailData.dailyEarnings.length > 0 ? (
                        selectedNote.detailData.dailyEarnings.map(day => (
                          <tr key={day.date}>
                            <td>{formatDateWithWeekday(day.date)}</td>
                            <td className={styles.alignRight}>{day.stopsCount}</td>
                            <td className={styles.alignRight}>{formatCurrency(day.earnings)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan={3} style={{fontStyle:'italic', color:'var(--muted-foreground)'}}>Keine Stops in diesem Zeitraum</td></tr>
                      )}
                      <tr className={styles.subtotalRow}>
                        <td colSpan={2}><strong>Zwischensumme Stopvergütung</strong></td>
                        <td className={styles.alignRight}><strong>{formatCurrency(selectedNote.totalStopEarnings)}</strong></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                
                {/* Packaging Table */}
                <h3 className={styles.webSectionTitle}>Verpackungsvergütung ({formatCurrency(selectedNote.packagingCompensation)} / Tag)</h3>
                <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Datum</th>
                        <th className={styles.alignRight}>Verpackung</th>
                        <th className={styles.alignRight}>Betrag</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedNote.detailData.packagingDays.length > 0 ? (
                        selectedNote.detailData.packagingDays.map(day => (
                          <tr key={day.date}>
                            <td>{formatDateWithWeekday(day.date)}</td>
                            <td className={styles.alignRight}>✓</td>
                            <td className={styles.alignRight}>{formatCurrency(selectedNote.packagingCompensation)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan={3} style={{fontStyle:'italic', color:'var(--muted-foreground)'}}>Keine Verpackungstage in diesem Zeitraum</td></tr>
                      )}
                      <tr className={styles.subtotalRow}>
                        <td colSpan={2}><strong>Zwischensumme Verpackungsvergütung</strong></td>
                        <td className={styles.alignRight}><strong>{formatCurrency(selectedNote.totalPackagingEarnings)}</strong></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                
                {/* Summary */}
                <div className={styles.summaryBlock}>
                  <div className={styles.summaryRow}><span>Summe Stopvergütung:</span><span>{formatCurrency(selectedNote.totalStopEarnings)}</span></div>
                  <div className={styles.summaryRow}><span>Summe Verpackungsvergütung:</span><span>{formatCurrency(selectedNote.totalPackagingEarnings)}</span></div>
                  {selectedNote.vatAmount != null ? (
                    <>
                      <div className={styles.summaryRow}><span>Gesamtbetrag (Netto):</span><span>{formatCurrency(selectedNote.totalStopEarnings + selectedNote.totalPackagingEarnings)}</span></div>
                      <div className={styles.summaryRow}><span>Umsatzsteuer (7%):</span><span>{formatCurrency(selectedNote.vatAmount)}</span></div>
                      <div className={`${styles.summaryRow} ${styles.summaryTotal}`}><span>Endbetrag inkl. USt.:</span><span>{formatCurrency(selectedTotalWithVat)}</span></div>
                    </>
                  ) : (
                    <div className={`${styles.summaryRow} ${styles.summaryTotal}`}><span>Gesamtbetrag:</span><span>{formatCurrency(selectedNote.totalAmount)}</span></div>
                  )}
                </div>
                
                {/* Status info */}
                <div className={styles.statusInfoBlock}>
                  {selectedNote.status === 'pending' && <Badge variant="warning">Ausstehend – Freigabe erforderlich</Badge>}
                  {selectedNote.status === 'approved_manual' && <Badge variant="success">Manuell freigegeben {selectedNote.approvedAt ? `am ${formatDateTime(selectedNote.approvedAt)}` : ''}</Badge>}
                  {selectedNote.status === 'approved_auto' && <Badge className={styles.blueBadge}>Automatisch freigegeben {selectedNote.approvedAt ? `am ${formatDateTime(selectedNote.approvedAt)}` : ''}</Badge>}
                </div>
              </div>
            ) : selectedNote ? (
              <div className={styles.gutschriftWebView}>
                {/* Sender Info */}
                <div className={styles.senderBlock}>
                  <strong>Biber Fieber UG (haftungsbeschränkt)</strong>
                  <p>Am Hartholz 3</p>
                  <p>82239 Alling</p>
                </div>
                
                <div className={styles.dividerLine} />
                <h2 className={styles.gutschriftTitle}>GUTSCHRIFT RECHNUNG</h2>
                <div className={styles.dividerLine} />
                
                <div className={styles.metaRow}>
                  <div className={styles.metaInfo} style={{textAlign: 'left'}}>
                    <p><strong>Gutschriftsnummer:</strong> {selectedNote.gutschriftNumber}</p>
                    <p><strong>Leistungszeitraum:</strong> {formatDate(selectedNote.blockStart)} – {formatDate(selectedNote.blockEnd)}</p>
                    <p><strong>Stopvergütung:</strong> {formatCurrency(selectedNote.stopCompensation)} / Stop</p>
                    <p><strong>Verpackungsvergütung:</strong> {formatCurrency(selectedNote.packagingCompensation)} / Tag</p>
                  </div>
                </div>
                
                {/* Summary */}
                <div className={styles.summaryBlock} style={{alignSelf: 'stretch', maxWidth: 'none'}}>
                  <div className={styles.summaryRow}><span>Summe Stopvergütung:</span><span>{formatCurrency(selectedNote.totalStopEarnings)}</span></div>
                  <div className={styles.summaryRow}><span>Summe Verpackungsvergütung:</span><span>{formatCurrency(selectedNote.totalPackagingEarnings)}</span></div>
                  {selectedNote.vatAmount != null ? (
                    <>
                      <div className={styles.summaryRow}><span>Gesamtbetrag (Netto):</span><span>{formatCurrency(selectedNote.totalStopEarnings + selectedNote.totalPackagingEarnings)}</span></div>
                      <div className={styles.summaryRow}><span>Umsatzsteuer (7%):</span><span>{formatCurrency(selectedNote.vatAmount)}</span></div>
                      <div className={`${styles.summaryRow} ${styles.summaryTotal}`}><span>Endbetrag inkl. USt.:</span><span>{formatCurrency(selectedTotalWithVat)}</span></div>
                    </>
                  ) : (
                    <div className={`${styles.summaryRow} ${styles.summaryTotal}`}><span>Gesamtbetrag:</span><span>{formatCurrency(selectedNote.totalAmount)}</span></div>
                  )}
                </div>
                
                <div className={styles.statusInfoBlock}>
                  {selectedNote.status === 'pending' && <Badge variant="warning">Ausstehend – Freigabe erforderlich</Badge>}
                  {selectedNote.status === 'approved_manual' && <Badge variant="success">Manuell freigegeben {selectedNote.approvedAt ? `am ${formatDateTime(selectedNote.approvedAt)}` : ''}</Badge>}
                  {selectedNote.status === 'approved_auto' && <Badge className={styles.blueBadge}>Automatisch freigegeben {selectedNote.approvedAt ? `am ${formatDateTime(selectedNote.approvedAt)}` : ''}</Badge>}
                </div>
                
                <p className={styles.noDetailHint}>Detaillierte Tagesaufstellung nicht verfügbar. Bitte den Admin bitten, die Gutschrift neu zu erstellen.</p>
              </div>
            ) : null}
          </div>
          <SheetFooter>
            <div className={styles.sheetActions}>
              {selectedNote?.detailData && (
                <Button onClick={handleOpenPdf} disabled={isGeneratingPdf}>
                  {isGeneratingPdf ? <Spinner size="sm" /> : <FileText size={16} />}
                  Als PDF öffnen
                </Button>
              )}
              {selectedNote?.status === 'pending' && (
                <Button 
                  className={styles.approveButton}
                  onClick={() => { approveMutation.mutate(selectedNote.id); setSelectedNote(null); }}
                  disabled={approveMutation.isPending}
                >
                  Freigeben
                </Button>
              )}
              <Button variant="outline" onClick={() => setSelectedNote(null)}>Schließen</Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
};